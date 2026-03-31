import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import PDFDocument from "pdfkit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("id");

  if (!invoiceId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, partners(nom, email, utm, code)")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const partner = invoice.partners as { nom: string; email: string } | null;

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", resolve);
    doc.on("error", reject);

    // Header
    doc.fontSize(22).fillColor("#0A3855").text("Qlower", 50, 50);
    doc.fontSize(10).fillColor("#6b7280").text("Programme partenaire", 50, 78);

    doc.fontSize(10).fillColor("#111827")
      .text(`Facture n° ${invoice.id}`, 350, 50, { align: "right" })
      .text(`Date : ${new Date(invoice.date).toLocaleDateString("fr-FR")}`, 350, 65, { align: "right" })
      .text(`Statut : ${invoice.statut}`, 350, 80, { align: "right" });

    // Divider
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#e5e7eb").stroke();

    // Partner info
    doc.fontSize(10).fillColor("#6b7280").text("Partenaire", 50, 130);
    doc.fontSize(12).fillColor("#111827").text(partner?.nom ?? "N/A", 50, 148);
    if (partner?.email) {
      doc.fontSize(10).fillColor("#6b7280").text(partner.email, 50, 165);
    }

    // Table header
    doc.rect(50, 220, 495, 28).fillColor("#0A3855").fill();
    doc.fontSize(10).fillColor("#ffffff")
      .text("Description", 60, 230)
      .text("Montant", 470, 230, { align: "right", width: 65 });

    // Table row
    doc.rect(50, 248, 495, 36).fillColor("#f9fafb").fill();
    doc.fontSize(10).fillColor("#111827")
      .text(`Commission partenaire — ${partner?.nom ?? ""}`, 60, 258)
      .text(`${invoice.montant.toLocaleString("fr-FR")} €`, 470, 258, { align: "right", width: 65 });

    // Total
    doc.moveTo(50, 295).lineTo(545, 295).strokeColor("#e5e7eb").stroke();
    doc.fontSize(13).fillColor("#0A3855")
      .text("Total", 350, 310)
      .text(`${invoice.montant.toLocaleString("fr-FR")} €`, 470, 310, { align: "right", width: 65 });

    // Footer
    doc.fontSize(9).fillColor("#9ca3af")
      .text("Qlower — Programme partenaire", 50, 750, { align: "center", width: 495 });

    doc.end();
  });

  const pdfBuffer = Buffer.concat(chunks);

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${invoice.id}.pdf"`,
    },
  });
}
