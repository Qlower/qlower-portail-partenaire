// POST /api/admin/send-payment-confirmation
// Body: { partner_id, year, amount, paid_at? }
//
// Envoie au PARTENAIRE un email confirmant que sa facture/commission a été réglée
// (date, montant, rappel code promo + lien d'affiliation). Déclenché après que
// l'admin a validé "payée". Admin-only.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getResend, FROM } from "@/lib/resend";
import { buildSignupLink } from "@/services/links";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const partnerId = body.partner_id as string | undefined;
  const year = body.year as number | undefined;
  const amount = Number(body.amount) || 0;
  const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();
  if (!partnerId || !year) {
    return NextResponse.json({ error: "partner_id et year requis" }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: partner } = await sb
    .from("partners")
    .select("nom, email, code, utm, contact_prenom, commission_ht")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return NextResponse.json({ error: "partenaire introuvable" }, { status: 404 });
  if (!partner.email) return NextResponse.json({ sent: 0, reason: "no_email" });

  const lien = buildSignupLink(partner.utm || "", partner.code || null);
  const dateStr = paidAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const montantStr = `${amount.toLocaleString("fr-FR")} € ${partner.commission_ht ? "HT" : "TTC"}`;
  const prenom = partner.contact_prenom?.trim() || partner.nom;
  const subject = `✅ Votre commission Qlower ${year} a été réglée`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
  <h2 style="color:#0A3855">Paiement effectué ✅</h2>
  <p>Bonjour ${prenom},</p>
  <p>Nous vous confirmons le règlement de votre commission d'apporteur d'affaires Qlower pour <strong>${year}</strong>.</p>
  <table style="border-collapse:collapse;margin:16px 0;width:100%">
    <tr><td style="padding:8px 0;color:#6b7280">Montant réglé</td><td style="padding:8px 0;text-align:right;font-weight:bold;color:#0A3855">${montantStr}</td></tr>
    <tr><td style="padding:8px 0;color:#6b7280">Date de paiement</td><td style="padding:8px 0;text-align:right">${dateStr}</td></tr>
    ${partner.code ? `<tr><td style="padding:8px 0;color:#6b7280">Votre code promo</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-weight:bold">${partner.code}</td></tr>` : ""}
  </table>
  <p>Pour continuer à recommander Qlower, voici votre lien d'affiliation :</p>
  <p><a href="${lien}" style="color:#0A3855">${lien}</a></p>
  <p style="margin-top:24px">Merci pour votre partenariat,<br/>L'équipe Qlower</p>
</div>`;

  try {
    await getResend().emails.send({ from: FROM, to: [partner.email], subject, html });
    return NextResponse.json({ sent: 1, email: partner.email });
  } catch (e) {
    return NextResponse.json({ sent: 0, error: e instanceof Error ? e.message : "envoi échoué" }, { status: 500 });
  }
}
