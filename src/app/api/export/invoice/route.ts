import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// Generate a simple invoice PDF as HTML-to-PDF
// Using a lightweight approach without puppeteer for serverless compatibility
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

  // Return invoice data as JSON for now — PDF generation can be added
  // with @react-pdf/renderer or an external service
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Facture ${invoice.id}</title>
<style>
  body { font-family: Inter, sans-serif; padding: 40px; color: #1a2e44; }
  .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .logo { font-size: 24px; font-weight: 700; color: #0A3855; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #0A3855; color: white; padding: 10px; text-align: left; }
  td { padding: 10px; border-bottom: 1px solid #e5e7eb; }
  .total { font-size: 20px; font-weight: 700; text-align: right; margin-top: 20px; }
</style></head><body>
  <div class="header">
    <div><div class="logo">Qlower</div><div>Appel de facturation partenaire</div></div>
    <div style="text-align:right"><strong>${invoice.id}</strong><br>${invoice.date}<br>Statut: ${invoice.statut}</div>
  </div>
  <div><strong>Partenaire:</strong> ${invoice.partners?.nom || "N/A"}</div>
  <table><tr><th>Description</th><th>Montant</th></tr>
  <tr><td>Commission partenaire — ${invoice.partners?.nom}</td><td>${invoice.montant} €</td></tr></table>
  <div class="total">Total: ${invoice.montant} €</div>
</body></html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
