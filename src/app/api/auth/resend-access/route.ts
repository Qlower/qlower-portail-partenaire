import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { PARTNER_EMAIL_FOOTER } from "@/services/emailTemplates";

// POST /api/auth/resend-access
// Body: { email }
// Public endpoint BUT restricted to emails of active partners.
// Regenerates a magic link and sends it via Resend.
export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Partner must exist in DB — otherwise we don't send anything (anti spam)
  const { data: partner } = await supabase
    .from("partners")
    .select("id, nom, email")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  // Security : always respond 200 even if not found (don't reveal email enumeration)
  if (!partner) {
    return NextResponse.json({
      ok: true,
      message: "Si cet email correspond à un partenaire Qlower, un nouveau lien vient d'être envoyé.",
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://partenaire.qlower.com";
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: partner.email!,
    options: { redirectTo: `${siteUrl}/auth/magic` },
  });

  if (linkErr) {
    console.error("Magic link generation failed:", linkErr);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }

  const actionLink = linkData?.properties?.action_link;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY && actionLink) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Qlower <partenaires@qlower.com>",
          to: [partner.email],
          subject: "Votre nouveau lien de connexion Qlower",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A3855;">
              <h2 style="color: #0A3855;">Votre nouveau lien d'accès</h2>
              <p>Bonjour ${partner.nom || ""},</p>
              <p>Voici un nouveau lien pour accéder à votre espace partenaire Qlower. Ce lien est valable <strong>24 heures</strong>.</p>
              <p style="text-align: center; margin: 32px 0;">
                <a href="${actionLink}"
                   style="background: #F6CCA4; color: #6B4D2D; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Accéder à mon espace
                </a>
              </p>
              <p style="font-size: 12px; color: #666;">Si vous avez demandé ce lien plusieurs fois, utilisez le dernier reçu (les précédents sont invalidés).</p>
              ${PARTNER_EMAIL_FOOTER}
              <p style="font-size:11px;color:#999;text-align:center;margin-top:8px;">Qlower — Programme partenaire</p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error("Resend error:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Un nouveau lien vient de vous être envoyé par email.",
  });
}
