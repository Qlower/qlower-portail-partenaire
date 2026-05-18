import { NextRequest, NextResponse } from "next/server";
import { renderContractHtml } from "@/lib/contract-template";
import type { Partner } from "@/types";

// POST — notify Coline + send welcome email to partner
// Phase 2 contrat : si tous les champs juridiques sont renseignés, un brouillon
// de contrat est généré (HTML) et joint à l'email envoyé à Coline.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { resend, FROM } = await import("@/lib/resend");
    const prenom = body.prenom || body.partnerName || "Partenaire";

    // Construit un objet Partner-like avec ce que RegisterForm a envoyé
    const partnerLike: Partial<Partner> = {
      id: body.partnerId || "",
      nom: body.partnerName || "",
      contact_prenom: body.prenom || null,
      contact_nom: body.nom || null,
      email: body.partnerEmail || null,
      siret: body.siret || null,
      adresse: body.adresse || null,
      ville: body.ville || null,
      code_postal: body.codePostal || null,
      forme_juridique: body.formeJuridique || null,
      capital: body.capital || null,
      rcs: body.rcs || null,
      contact_civilite: body.contactCivilite || null,
      contact_position: body.contactPosition || null,
    };

    // Le contrat n'a de sens que si les champs juridiques sont fournis.
    // Sinon Coline reçoit juste l'email d'info sans brouillon.
    const hasContractFields =
      !!body.formeJuridique && !!body.capital && !!body.rcs &&
      !!body.contactCivilite && !!body.contactPosition;

    const contractHtml = hasContractFields
      ? renderContractHtml(partnerLike as Partner)
      : null;
    // Nom du fichier propre pour Coline : "Contrat-MaSociete-2026.html"
    const safeName = (body.partnerName || "partenaire")
      .replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 40);
    const contractFilename = `Contrat-${safeName}-${new Date().getFullYear()}.html`;

    // 1. Notify Coline
    const notifyColine = resend.emails.send({
      from: FROM,
      to: "coline@qlower.com",
      cc: "alexandre@qlower.com",
      subject: `Nouveau partenaire inscrit — ${body.partnerName}${contractHtml ? " (contrat joint)" : ""}`,
      html: `<div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:32px;">
        <h2 style="color:#0A3855;">Nouveau partenaire inscrit</h2>
        ${contractHtml ? `
        <div style="background:#FFF6E5;border-left:4px solid #F6CCA4;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
          <strong style="color:#0A3855;">📄 Un brouillon de contrat est joint à cet email.</strong><br/>
          <span style="font-size:13px;color:#555;">Ouvrir la pièce jointe <code>${contractFilename}</code> dans le navigateur, vérifier les infos puis Ctrl+P → Enregistrer en PDF avant envoi pour signature.</span>
        </div>` : `
        <div style="background:#FEF3C7;border-left:4px solid #F59E0B;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
          <strong style="color:#92400E;">⚠️ Brouillon de contrat non joint</strong><br/>
          <span style="font-size:13px;color:#555;">Le partenaire n'a pas renseigné toutes les infos juridiques (forme, capital, RCS, civilité ou fonction du signataire). Utilise le bouton "Générer contrat" dans l'admin une fois ces champs complétés.</span>
        </div>`}
        <p><strong>Entreprise :</strong> ${body.partnerName || ""}</p>
        <p><strong>Forme :</strong> ${body.formeJuridique || "—"}, capital ${body.capital || "—"}, RCS ${body.rcs || "—"}</p>
        <p><strong>Signataire :</strong> ${body.contactCivilite || ""} ${body.prenom || ""} ${body.nom || ""} — ${body.contactPosition || "—"}</p>
        <p><strong>Email :</strong> ${body.partnerEmail || ""}</p>
        <p><strong>Téléphone :</strong> ${body.telephone || ""}</p>
        <p><strong>Métier :</strong> ${body.metier || ""}</p>
        <p><strong>SIRET :</strong> ${body.siret || ""}</p>
        <p><strong>TVA :</strong> ${body.tva || ""}</p>
        <p><strong>Adresse :</strong> ${[body.adresse, body.codePostal, body.ville].filter(Boolean).join(", ") || ""}</p>
        <p><strong>IBAN :</strong> ${body.iban || ""}</p>
        <p><strong>BIC :</strong> ${body.bic || ""}</p>
        ${body.kbisUrl ? `<p><a href="${body.kbisUrl}">Voir le Kbis</a></p>` : ""}
        <hr>
        <a href="https://partenaire.qlower.com/admin" style="color:#0A3855;">Voir dans l'admin →</a>
      </div>`,
      attachments: contractHtml ? [
        {
          filename: contractFilename,
          content: Buffer.from(contractHtml, "utf-8"),
        },
      ] : undefined,
    });

    // 2. Welcome email to partner
    const welcomePartner = body.partnerEmail ? resend.emails.send({
      from: FROM,
      to: body.partnerEmail,
      subject: `Bienvenue ${prenom} — Votre inscription est en cours`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px;">
        <div style="background:#0A3855;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Qlower</h1>
          <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:11px;text-transform:uppercase;letter-spacing:2px;">Programme Partenaire</p>
        </div>
        <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:0;">
          <h2 style="color:#0A3855;margin:0 0 12px;">Bienvenue ${prenom} !</h2>
          <p style="color:#374151;line-height:1.6;">Merci pour votre inscription au programme partenaire Qlower. Votre demande a bien été enregistrée.</p>
          <div style="background:#f0f7fa;border-left:4px solid #0A3855;border-radius:8px;padding:16px;margin:20px 0;">
            <p style="margin:0 0 8px;font-weight:600;color:#0A3855;">Prochaines étapes :</p>
            <p style="margin:0;color:#374151;line-height:1.8;">
              1. Coline vous contacte sous <strong>48h</strong><br>
              2. Signature de votre <strong>contrat d'affiliation</strong><br>
              3. Activation de votre <strong>code promo et tableau de bord</strong>
            </p>
          </div>
          <p style="color:#374151;line-height:1.6;">Votre espace est déjà accessible sur <a href="https://partenaire.qlower.com" style="color:#0A3855;font-weight:600;">partenaire.qlower.com</a>. Le tableau de bord complet sera disponible après signature du contrat.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://partenaire.qlower.com/dashboard" style="background:#0A3855;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accéder à mon espace</a>
          </div>
          <p style="color:#6b7280;font-size:13px;">Question ? Contactez Coline : <a href="mailto:coline@qlower.com" style="color:#0A3855;">coline@qlower.com</a></p>
        </div>
      </div>`,
    }) : Promise.resolve(null);

    await Promise.all([notifyColine, welcomePartner]);
    return NextResponse.json({ ok: true, contractAttached: hasContractFields });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[register/notify] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
