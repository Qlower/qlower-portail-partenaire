export interface PartnerEmailData {
  nom: string;
  email: string;
  utm: string;
  code: string;
  leads: number;
  abonnes: number;
}

export type TemplateKey = "presentation" | "relance" | "performance" | "nouveaute";

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0A3855 0%,#0d4a6f 100%);border-radius:16px 16px 0 0;padding:32px 32px 24px;text-align:center;">
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Qlower</h1>
      <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:2px;font-weight:600;">Programme Partenaire</p>
    </div>
    <!-- Body -->
    <div style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
      ${content}
      <!-- Footer -->
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
          Qlower &mdash; Gestion fiscale immobili&egrave;re simplifi&eacute;e<br>
          <a href="https://qlower.com" style="color:#0A3855;text-decoration:none;">qlower.com</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function btn(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0A3855;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:14px;letter-spacing:-0.2px;">${text}</a>`;
}

function statCard(label: string, value: string, color: string = "#0A3855"): string {
  return `<div style="flex:1;background:#f8fafc;border-radius:12px;padding:16px 18px;text-align:center;border:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${label}</p>
    <p style="margin:8px 0 0;font-size:24px;font-weight:700;color:${color};">${value}</p>
  </div>`;
}

export function getEmailContent(key: TemplateKey, p: PartnerEmailData): { subject: string; html: string } {
  const link = `https://secure.qlower.com/signup?utm_source=${p.utm}&utm_medium=affiliation&utm_campaign=${p.code}`;
  const conversionRate = p.leads > 0 ? ((p.abonnes / p.leads) * 100).toFixed(1) : "0";
  const commission = p.abonnes * 100;

  switch (key) {
    case "presentation":
      return {
        subject: `${p.nom}, découvrez votre espace partenaire Qlower !`,
        html: layout(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0A3855;font-weight:700;">Bienvenue ${p.nom} !</h2>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            Nous sommes ravis de vous accueillir dans le programme partenaire Qlower. Vous rejoignez un r&eacute;seau de professionnels qui accompagnent leurs clients investisseurs LMNP vers une gestion fiscale simplifi&eacute;e.
          </p>

          <div style="background:#f0f7fa;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #0A3855;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#0A3855;">Vos avantages partenaire :</p>
            <table style="width:100%;font-size:14px;color:#374151;line-height:1.8;">
              <tr><td style="padding:2px 0;">&#10003;&nbsp; <strong>100 &euro; de commission</strong> par client abonn&eacute; / an</td></tr>
              <tr><td style="padding:2px 0;">&#10003;&nbsp; Tableau de bord d&eacute;di&eacute; en temps r&eacute;el</td></tr>
              <tr><td style="padding:2px 0;">&#10003;&nbsp; Supports de communication personnalis&eacute;s</td></tr>
              <tr><td style="padding:2px 0;">&#10003;&nbsp; Interlocuteur d&eacute;di&eacute; pour vous accompagner</td></tr>
            </table>
          </div>

          <div style="background:#fff8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #f6cca4;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre code partenaire</p>
            <p style="margin:0;font-size:22px;font-weight:700;color:#0A3855;letter-spacing:2px;font-family:monospace;">${p.code}</p>
          </div>

          <div style="text-align:center;margin:28px 0 8px;">
            ${btn("Acc&eacute;der &agrave; mon espace &rarr;", "https://partenaire.qlower.com/dashboard")}
          </div>
          <div style="text-align:center;margin-top:12px;">
            <a href="${link}" style="font-size:13px;color:#0A3855;text-decoration:underline;">Voir mon lien d'inscription partenaire</a>
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
            Pour toute question, r&eacute;pondez simplement &agrave; cet email.
          </p>
        `),
      };

    case "relance":
      return {
        subject: `${p.nom}, activez votre partenariat Qlower`,
        html: layout(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0A3855;font-weight:700;">On ne vous oublie pas !</h2>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            Bonjour ${p.nom},<br><br>
            Nous avons remarqu&eacute; que votre lien partenaire n'a pas encore &eacute;t&eacute; utilis&eacute;. C'est tout &agrave; fait normal au d&eacute;marrage &mdash; voici quelques id&eacute;es pour commencer :
          </p>

          <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;font-size:14px;color:#374151;line-height:2;">
              <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">1</span> Partagez votre lien lors de vos prochains rendez-vous</td></tr>
              <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">2</span> Mentionnez Qlower dans votre newsletter client</td></tr>
              <tr><td style="padding:2px 0;"><span style="display:inline-block;width:24px;height:24px;background:#E5EDF1;border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#0A3855;margin-right:8px;">3</span> Utilisez les supports du kit partenaire</td></tr>
            </table>
          </div>

          <div style="text-align:center;margin:28px 0 8px;">
            ${btn("Mon espace partenaire &rarr;", "https://partenaire.qlower.com/dashboard")}
          </div>
          <div style="text-align:center;margin-top:12px;">
            <a href="${link}" style="font-size:13px;color:#0A3855;text-decoration:underline;">Copier mon lien d'inscription</a>
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
            Besoin d'un coup de pouce ? R&eacute;pondez simplement &agrave; cet email.
          </p>
        `),
      };

    case "performance":
      return {
        subject: `Bilan partenaire Qlower — ${p.nom}`,
        html: layout(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0A3855;font-weight:700;">Votre bilan de performance</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
            Bonjour ${p.nom}, voici un r&eacute;capitulatif de votre activit&eacute; partenaire Qlower.
          </p>

          <!-- Stats grid -->
          <!--[if mso]><table role="presentation" cellspacing="8"><tr><td><![endif]-->
          <div style="display:flex;gap:10px;margin-bottom:20px;">
            ${statCard("Leads", String(p.leads))}
            ${statCard("Abonn&eacute;s", String(p.abonnes), "#059669")}
          </div>
          <!--[if mso]></td></tr></table><![endif]-->

          <div style="display:flex;gap:10px;margin-bottom:24px;">
            ${statCard("Conversion", conversionRate + "%", "#0A3855")}
            ${statCard("Commission", commission + " &euro;/an", "#059669")}
          </div>

          ${p.leads > 0
            ? `<div style="background:#ecfdf5;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #a7f3d0;">
                <p style="margin:0;font-size:14px;color:#065f46;font-weight:500;">
                  &#127942; Bravo pour votre implication ! Continuez sur cette lanc&eacute;e.
                </p>
              </div>`
            : `<div style="background:#fff8f0;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #f6cca4;">
                <p style="margin:0;font-size:14px;color:#92400e;font-weight:500;">
                  Vous n'avez pas encore g&eacute;n&eacute;r&eacute; de leads. Partagez votre lien pour d&eacute;marrer !
                </p>
              </div>`
          }

          <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre lien partenaire</p>
            <a href="${link}" style="font-size:13px;color:#0A3855;word-break:break-all;">${link}</a>
          </div>

          <div style="text-align:center;margin:28px 0 8px;">
            ${btn("Voir mon tableau de bord &rarr;", "https://partenaire.qlower.com/dashboard")}
          </div>
        `),
      };

    case "nouveaute":
      return {
        subject: `Nouveauté Qlower — Programme partenaire`,
        html: layout(`
          <h2 style="margin:0 0 8px;font-size:20px;color:#0A3855;font-weight:700;">Nouveaut&eacute; programme partenaire</h2>
          <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
            Bonjour ${p.nom},<br><br>
            Nous avons le plaisir de vous annoncer une nouveaut&eacute; dans notre programme partenaire.
          </p>

          <div style="background:#f0f7fa;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid #F6CCA4;">
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;font-style:italic;">
              [&Agrave; compl&eacute;ter avant envoi : d&eacute;crivez ici la nouveaut&eacute; ou la mise &agrave; jour &agrave; communiquer aux partenaires]
            </p>
          </div>

          <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #e5e7eb;">
            <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre lien reste inchang&eacute;</p>
            <a href="${link}" style="font-size:13px;color:#0A3855;word-break:break-all;">${link}</a>
          </div>

          <div style="text-align:center;margin:28px 0 8px;">
            ${btn("Mon espace partenaire &rarr;", "https://partenaire.qlower.com/dashboard")}
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">
            &Agrave; tr&egrave;s vite,<br>L'&eacute;quipe Qlower
          </p>
        `),
      };
  }
}
