import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import PDFDocument from "pdfkit";

// GET /api/partner/invoice-call?partner_id=X&year=Y
// Generates a non-fiscal "appel à facturation" PDF for partner reference.
// This is NOT the real invoice — it's a recap that the partner uses to
// issue their OWN invoice (with their SIRET, their numbering, etc).
export async function GET(request: NextRequest) {
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

  // Fetch partner details
  const { data: partner } = await supabase
    .from("partners")
    .select("nom, email, utm, code, siret, adresse, ville, code_postal")
    .eq("id", partnerId)
    .single();
  if (!partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  // Compute commission for the year via the existing commissions API logic.
  // We inline-call it rather than re-implement to stay consistent.
  const origin = new URL(request.url).origin;
  const commRes = await fetch(
    `${origin}/api/partner/commissions?partner_id=${partnerId}&year=${year}`
  );
  const commData = (await commRes.json()) as {
    totalSubscribers?: number;
    totalCommission?: number;
    ruleDetails?: Array<{ label: string; montant: number; type: string }>;
  };
  const totalAmount = commData.totalCommission ?? 0;
  const totalSubs = commData.totalSubscribers ?? 0;
  const activeRules = (commData.ruleDetails ?? []).filter((r) => r.montant > 0);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", resolve);
    doc.on("error", reject);

    // Header
    doc.fontSize(22).fillColor("#0A3855").text("Qlower", 50, 50);
    doc.fontSize(9).fillColor("#6b7280").text("Programme partenaire", 50, 78);

    doc.fontSize(10).fillColor("#111827")
      .text(`APPEL A FACTURATION`, 350, 50, { align: "right" })
      .text(`Annee ${year}`, 350, 65, { align: "right" })
      .text(`Emis le ${new Date().toLocaleDateString("fr-FR")}`, 350, 80, { align: "right" });

    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#e5e7eb").stroke();

    // Partner block
    doc.fontSize(10).fillColor("#6b7280").text("Apporteur d'affaires", 50, 130);
    doc.fontSize(12).fillColor("#111827").text(partner.nom ?? "N/A", 50, 148);
    if (partner.siret) doc.fontSize(9).fillColor("#6b7280").text(`SIRET : ${partner.siret}`, 50, 165);
    if (partner.adresse) doc.fontSize(9).fillColor("#6b7280").text(partner.adresse, 50, 178);
    if (partner.code_postal || partner.ville) {
      doc.fontSize(9).fillColor("#6b7280").text(
        `${partner.code_postal ?? ""} ${partner.ville ?? ""}`.trim(),
        50,
        191
      );
    }
    if (partner.email) doc.fontSize(9).fillColor("#6b7280").text(partner.email, 50, 204);

    // Summary
    doc.rect(50, 230, 495, 28).fillColor("#0A3855").fill();
    doc.fontSize(11).fillColor("#ffffff")
      .text(`Commission due pour l'annee ${year}`, 60, 238)
      .text(`${totalAmount.toLocaleString("fr-FR")} EUR`, 470, 238, { align: "right", width: 65 });

    doc.fontSize(9).fillColor("#6b7280").text(
      `Calcul base sur ${totalSubs} abonne(s) du programme partenaire.`,
      50, 268
    );

    // Rules breakdown
    let y = 295;
    doc.fontSize(10).fillColor("#374151").text("Regles appliquees :", 50, y);
    y += 20;
    activeRules.forEach((r) => {
      doc.fontSize(9).fillColor("#6b7280")
        .text(`- ${r.label} : ${r.montant} EUR`, 60, y)
        .text(
          r.type === "recurring" ? "par abonne / an" : "par nouvel abonne",
          300, y
        );
      y += 15;
    });

    // Instructions
    y += 20;
    doc.fontSize(10).fillColor("#0A3855").text("Comment proceder :", 50, y);
    y += 18;
    doc.fontSize(9).fillColor("#374151");
    const steps = [
      "1. Emettez votre facture avec VOTRE SIRET, numerotation et mentions legales",
      "2. Indiquez le montant ci-dessus et la designation : Commission apporteur Qlower " + year,
      "3. Connectez-vous sur partenaire.qlower.com > Revenus",
      "4. Cliquez sur 'Appel a facturation " + year + "' et uploadez votre PDF",
    ];
    steps.forEach((s) => {
      doc.text(s, 60, y);
      y += 14;
    });

    // Facturation info (bénéficiaire + RIB pour le virement)
    y += 16;
    doc.rect(50, y, 495, 2).fillColor("#e5e7eb").fill();
    y += 12;
    doc.fontSize(10).fillColor("#0A3855").text("Facturer a :", 50, y);
    y += 16;
    doc.fontSize(9).fillColor("#111827").font("Helvetica-Bold")
      .text("ComptAppart SAS", 60, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor("#374151")
      .text("N° TVA intracommunautaire : FR03 883 386 757", 60, y);
    y += 14;
    doc.fontSize(9).fillColor("#6b7280")
      .text("Reglement attendu par virement SEPA sur le compte suivant :", 60, y);
    y += 16;
    doc.fontSize(9).fillColor("#111827").font("Helvetica-Bold")
      .text("IBAN :", 60, y);
    doc.font("Helvetica").fontSize(9).fillColor("#111827")
      .text("FR76 1695 8000 0121 0480 5641 741", 110, y);
    y += 13;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827")
      .text("BIC :", 60, y);
    doc.font("Helvetica").fontSize(9).fillColor("#111827")
      .text("QNTOFRP1XXX", 110, y);

    // Footer
    doc.fontSize(8).fillColor("#9ca3af")
      .text(
        "Document non fiscal - simple recap de commission. La facture officielle doit etre emise par l'apporteur.",
        50, 770, { align: "center", width: 495 }
      )
      .text("Qlower / ComptAppart SAS - Programme partenaire", 50, 785, { align: "center", width: 495 });

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="appel-facturation-${partner.utm}-${year}.pdf"`,
    },
  });
}
