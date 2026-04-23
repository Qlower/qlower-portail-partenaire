import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/partner/invoices/[id]/file → download the uploaded PDF
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("file_url, partner_id, year")
    .eq("id", id)
    .single();

  if (!invoice?.file_url) {
    return NextResponse.json({ error: "No file uploaded for this invoice" }, { status: 404 });
  }

  const { data: fileData, error } = await supabase.storage
    .from("partner-invoices")
    .download(invoice.file_url);

  if (error || !fileData) {
    return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
  }

  const buf = Buffer.from(await fileData.arrayBuffer());
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${invoice.partner_id}-${invoice.year}.pdf"`,
    },
  });
}
