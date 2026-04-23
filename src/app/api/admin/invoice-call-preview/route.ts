import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/invoice-call-preview?partner_id=X&year=Y
// Returns the HTML preview of the email that would be sent.
// NO email is actually sent. Used for the preview modal before confirming.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const year = parseInt(searchParams.get("year") || "0");

  if (!partnerId || !year) {
    return NextResponse.json(
      { error: "partner_id and year are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: partner } = await supabase
    .from("partners")
    .select("nom, email")
    .eq("id", partnerId)
    .single();
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const commRes = await fetch(
    `${origin}/api/partner/commissions?partner_id=${partnerId}&year=${year}`
  );
  const commData = (await commRes.json()) as { totalCommission?: number };
  const amount = commData.totalCommission ?? 0;

  const subject = `Appel à facturation ${year} — ${amount.toLocaleString("fr-FR")}€ de commission`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A3855;">
      <h2 style="color: #0A3855;">Votre commission ${year} est prête</h2>
      <p>Bonjour ${partner.nom ?? ""},</p>
      <p>Votre commission pour l'année <strong>${year}</strong> dans le programme partenaire Qlower s'élève à :</p>
      <p style="text-align: center; font-size: 32px; font-weight: bold; color: #0A3855; margin: 24px 0;">
        ${amount.toLocaleString("fr-FR")} €
      </p>
      <p>Pour recevoir ce règlement, merci de nous transmettre votre facture en suivant ces étapes :</p>
      <ol style="line-height: 1.8;">
        <li>Connectez-vous à votre espace partenaire</li>
        <li>Rendez-vous dans l'onglet <strong>Revenus</strong></li>
        <li>Cliquez sur le bouton <strong>Appel à facturation ${year}</strong></li>
        <li>Téléchargez le récapitulatif pour émettre votre propre facture</li>
        <li>Uploadez votre facture PDF dans le portail</li>
      </ol>
      <p style="text-align: center; margin: 32px 0;">
        <a href="https://partenaire.qlower.com/dashboard?as=${partnerId}"
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
      <p style="font-size: 12px; color: #666;">Pour toute question : partenaires@qlower.com</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="font-size: 11px; color: #999;">Qlower / ComptAppart SAS — Programme partenaire</p>
    </div>
  `;

  return NextResponse.json({
    from: "Qlower <partenaires@qlower.com>",
    to: partner.email,
    subject,
    html,
    amount,
    canSend: amount > 0 && !!partner.email,
  });
}
