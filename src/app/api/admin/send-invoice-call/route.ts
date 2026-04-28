import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { PARTNER_EMAIL_FOOTER } from "@/services/emailTemplates";

export const maxDuration = 60;

// POST /api/admin/send-invoice-call
// Body: { year: number, partner_ids?: string[] }
// Sends the "appel à facturation" email to all (or selected) partners whose
// commission for the year is > 0 AND who haven't uploaded an invoice yet.
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { year, partner_ids: requestedIds } = await request.json();
  if (!year) return NextResponse.json({ error: "year is required" }, { status: 400 });

  const supabase = createServiceClient();

  let partnerQuery = supabase
    .from("partners")
    .select("id, nom, email, utm, commission_ht")
    .eq("active", true)
    .not("email", "is", null);
  if (Array.isArray(requestedIds) && requestedIds.length > 0) {
    partnerQuery = partnerQuery.in("id", requestedIds);
  }
  const { data: partners } = await partnerQuery;
  if (!partners) return NextResponse.json({ sent: 0 });

  const origin = new URL(request.url).origin;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const results: Array<{ partner_id: string; status: string; amount?: number }> = [];

  for (const p of partners) {
    if (!p.email) {
      results.push({ partner_id: p.id, status: "skipped:no_email" });
      continue;
    }

    // Skip if already uploaded an invoice for this year
    const { data: existing } = await supabase
      .from("partner_invoices")
      .select("id, file_url, is_paid")
      .eq("partner_id", p.id)
      .eq("year", year)
      .maybeSingle();
    if (existing?.file_url) {
      results.push({ partner_id: p.id, status: "skipped:already_uploaded" });
      continue;
    }

    // Compute commission for the year
    const commRes = await fetch(
      `${origin}/api/partner/commissions?partner_id=${p.id}&year=${year}`
    );
    if (!commRes.ok) {
      results.push({ partner_id: p.id, status: "skipped:commission_error" });
      continue;
    }
    const commData = (await commRes.json()) as { totalCommission?: number };
    const amount = commData.totalCommission ?? 0;
    if (amount <= 0) {
      results.push({ partner_id: p.id, status: "skipped:zero_commission", amount });
      continue;
    }

    // Send email via Resend
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Qlower <partenaires@qlower.com>",
          to: [p.email],
          subject: `Appel à facturation ${year} — ${amount.toLocaleString("fr-FR")}€ ${p.commission_ht ? "HT" : "TTC"} de commission`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A3855;">
              <h2 style="color: #0A3855;">Votre commission ${year} est prête</h2>
              <p>Bonjour ${p.nom ?? ""},</p>
              <p>Votre commission pour l'année <strong>${year}</strong> dans le programme partenaire Qlower s'élève à :</p>
              <p style="text-align: center; font-size: 32px; font-weight: bold; color: #0A3855; margin: 24px 0;">
                ${amount.toLocaleString("fr-FR")} € ${p.commission_ht ? '<span style="font-size:18px;color:#6b7280;">HT</span>' : '<span style="font-size:18px;color:#6b7280;">TTC</span>'}
              </p>
              ${p.commission_ht ? '<p style="font-size:12px;color:#6b7280;text-align:center;font-style:italic;margin-top:-12px;">Montant exprimé Hors Taxes — appliquez la TVA selon votre régime sur votre facture.</p>' : ''}
              <p>Pour recevoir ce règlement, merci de nous transmettre votre facture en suivant ces étapes :</p>
              <ol style="line-height: 1.8;">
                <li>Connectez-vous à votre espace partenaire</li>
                <li>Rendez-vous dans l'onglet <strong>Revenus</strong></li>
                <li>Cliquez sur le bouton <strong>Appel à facturation ${year}</strong></li>
                <li>Téléchargez le récapitulatif pour émettre votre propre facture</li>
                <li>Uploadez votre facture PDF dans le portail</li>
              </ol>
              <p style="text-align: center; margin: 32px 0;">
                <a href="https://partenaire.qlower.com/dashboard?as=${p.id}"
                   style="background: #F6CCA4; color: #6B4D2D; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Accéder à mon espace
                </a>
              </p>
              <div style="background: #F8FAFB; border: 1px solid #E5EDF1; border-radius: 8px; padding: 16px; margin: 24px 0; font-size: 13px;">
                <p style="margin: 0 0 8px; color: #0A3855; font-weight: 700;">Facturer à :</p>
                <p style="margin: 0; color: #111827;"><strong>ComptAppart SAS</strong></p>
                <p style="margin: 4px 0; color: #555; font-size: 12px;">N° TVA : FR03 883 386 757</p>
                <p style="margin: 12px 0 4px; color: #555; font-size: 12px;">Règlement par virement SEPA :</p>
                <p style="margin: 0; color: #111827; font-family: monospace; font-size: 12px;">
                  <strong>IBAN</strong> &nbsp;FR76 1695 8000 0121 0480 5641 741<br/>
                  <strong>BIC</strong> &nbsp;&nbsp;&nbsp;QNTOFRP1XXX
                </p>
              </div>
              ${PARTNER_EMAIL_FOOTER}
              <p style="font-size:11px;color:#999;text-align:center;margin-top:8px;">Qlower / ComptAppart SAS — Programme partenaire</p>
            </div>
          `,
        }),
      });
      results.push({ partner_id: p.id, status: "sent", amount });
    } catch (e) {
      console.error("Email send failed:", e);
      results.push({ partner_id: p.id, status: "error" });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status.startsWith("skipped")).length;
  return NextResponse.json({ sent, skipped, total: results.length, details: results });
}
