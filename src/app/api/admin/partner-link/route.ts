import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY!;

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const body = await request.json();
  const { partner_id, sendEmail = false } = body;

  if (!partner_id) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  // Fetch partner email
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("email, nom")
    .eq("id", partner_id)
    .single();

  if (partnerError || !partner?.email) {
    return NextResponse.json({ error: "Partner not found or has no email" }, { status: 404 });
  }

  // Generate magic link — redirect_to must point to /auth/callback so the
  // PKCE code gets exchanged for a real session before landing on the dashboard
  const siteUrl = request.nextUrl.origin;
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: partner.email,
    options: {
      redirectTo: `${siteUrl}/auth/magic`,
    },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ error: error?.message || "Failed to generate link" }, { status: 500 });
  }

  const link = data.properties.action_link;

  // Optionally send email via Resend
  if (sendEmail) {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Qlower <noreply@qlower.com>",
        to: [partner.email],
        subject: "Votre espace partenaire Qlower",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="color: #0A3855; margin-bottom: 16px;">Bienvenue sur le portail partenaire Qlower</h2>
            <p style="color: #374151; margin-bottom: 24px;">
              Bonjour ${partner.nom},<br><br>
              Votre espace partenaire est prêt. Cliquez sur le lien ci-dessous pour vous connecter.
            </p>
            <a href="${link}" style="display: inline-block; background: #0A3855; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
              Accéder à mon espace partenaire →
            </a>
            <p style="color: #9CA3AF; font-size: 12px; margin-top: 24px;">
              Ce lien est à usage unique et expire dans 24h.
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
      return NextResponse.json({ link, emailError: errText }, { status: 207 });
    }

    // Record when access was sent
    await supabase
      .from("partners")
      .update({ lien_envoye_le: new Date().toISOString() })
      .eq("id", partner_id);
  }

  return NextResponse.json({ link });
}
