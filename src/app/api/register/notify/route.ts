import { NextRequest, NextResponse } from "next/server";
import { resend, FROM } from "@/lib/resend";
import { layout } from "@/services/emailTemplates";

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

// POST — notify Coline + send welcome email to partner
export async function POST(request: NextRequest) {
  const body: NotifyBody = await request.json();

  if (!body.partnerName) {
    return NextResponse.json({ error: "partnerName required" }, { status: 400 });
  }

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

  // 1. Notify Coline with full partner info
  const notifyColine = resend.emails.send({
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

  // 2. Send welcome email to partner
  const prenom = body.prenom || body.partnerName;
  const welcomePartner = resend.emails.send({
    from: FROM,
    to: body.partnerEmail,
    subject: `Bienvenue ${prenom} — Votre inscription est en cours de traitement`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:20px;color:#0A3855;font-weight:700;">Bienvenue ${prenom} !</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Merci pour votre inscription au programme partenaire Qlower. Nous avons bien reçu votre demande et nous sommes ravis de vous compter parmi nos futurs partenaires.
      </p>

      <div style="background:#f0f7fa;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #0A3855;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0A3855;">Prochaines étapes :</p>
        <table style="width:100%;font-size:14px;color:#374151;line-height:2;">
          <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">1</span> Coline, notre responsable partenariats, vous contacte sous <strong>48h</strong></td></tr>
          <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">2</span> Vous signez votre <strong>contrat d'affiliation</strong> personnalisé</td></tr>
          <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">3</span> Votre <strong>code promo et tableau de bord</strong> sont activés</td></tr>
        </table>
      </div>

      <div style="background:#fff8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #f6cca4;">
        <p style="margin:0;font-size:14px;color:#92400e;line-height:1.5;">
          <strong>Votre espace partenaire est déjà accessible</strong> — vous pouvez vous connecter à tout moment sur <a href="https://partenaire.qlower.com" style="color:#0A3855;font-weight:600;">partenaire.qlower.com</a>. Votre tableau de bord complet sera disponible dès la signature de votre contrat.
        </p>
      </div>

      <div style="text-align:center;margin:28px 0 8px;">
        <a href="https://partenaire.qlower.com/dashboard" style="display:inline-block;background:#0A3855;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:14px;">
          Accéder à mon espace →
        </a>
      </div>

      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
        Pour toute question, contactez Coline directement : <a href="mailto:coline@qlower.com" style="color:#0A3855;">coline@qlower.com</a>
      </p>
    `),
  });

  // Send both emails in parallel
  await Promise.all([notifyColine, welcomePartner]);

  return NextResponse.json({ ok: true });
}
