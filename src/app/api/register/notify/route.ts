import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { resend, FROM } from "@/lib/resend";

interface NotifyBody {
  partnerName: string;
  partnerEmail: string;
  kbisUrl: string | null;
  prenom?: string;
  nom?: string;
  metier?: string;
  siret?: string;
  tva?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  telephone?: string;
  iban?: string;
  bic?: string;
}

function row(label: string, value: string | undefined | null): string {
  if (!value) return "";
  return `<tr><td style="color:#9ca3af;width:140px;padding:4px 0;vertical-align:top;">${label}</td><td style="font-weight:500;padding:4px 0;">${value}</td></tr>`;
}

// POST — notify Coline of new partner registration (authenticated user, no admin required)
export async function POST(request: NextRequest) {
  // Verify the user is authenticated (but not necessarily admin)
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body: NotifyBody = await request.json();

  const rows = [
    row("Entreprise", body.partnerName),
    row("Prénom", body.prenom),
    row("Nom", body.nom),
    row("Email", body.partnerEmail ? `<a href="mailto:${body.partnerEmail}" style="color:#0A3855;">${body.partnerEmail}</a>` : null),
    row("Téléphone", body.telephone),
    row("Métier", body.metier),
    row("SIRET", body.siret),
    row("N° TVA", body.tva),
    row("Adresse", [body.adresse, body.codePostal, body.ville].filter(Boolean).join(", ")),
    row("IBAN", body.iban),
    row("BIC", body.bic),
  ].filter(Boolean).join("\n");

  await resend.emails.send({
    from: FROM,
    to: "coline@qlower.com",
    subject: `Nouveau partenaire inscrit — ${body.partnerName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;">
        <div style="background:#0A3855;border-radius:12px 12px 0 0;padding:20px 24px;">
          <h2 style="margin:0;font-size:16px;color:#ffffff;">Nouveau partenaire inscrit</h2>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.6);">Informations pour rédaction du contrat</p>
        </div>
        <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
          <table style="width:100%;font-size:14px;color:#374151;line-height:1.6;margin-bottom:20px;border-collapse:collapse;">
            ${rows}
          </table>
          ${body.kbisUrl ? `
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <a href="${body.kbisUrl}" style="display:inline-block;background:#0A3855;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:600;font-size:13px;">
              Voir le Kbis →
            </a>
          </div>` : ""}
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
            <a href="https://partenaire.qlower.com/admin" style="font-size:13px;color:#0A3855;text-decoration:underline;">
              Voir dans l'admin →
            </a>
          </div>
        </div>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
