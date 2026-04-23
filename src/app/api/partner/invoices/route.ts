import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

// GET /api/partner/invoices?partner_id=X
// Returns all invoices for a partner (ordered by year desc)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partner_invoices")
    .select("*")
    .eq("partner_id", partnerId)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/partner/invoices
// Body: multipart/form-data with fields { partner_id, year, amount, file (PDF) }
// Creates or replaces the invoice for that year.
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const partnerId = String(form.get("partner_id") || "");
  const year = parseInt(String(form.get("year") || "0"));
  const amount = parseFloat(String(form.get("amount") || "0"));
  const file = form.get("file") as File | null;

  if (!partnerId || !year || amount <= 0 || !file) {
    return NextResponse.json(
      { error: "partner_id, year, amount > 0 and file (PDF) are required" },
      { status: 400 }
    );
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are accepted" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Upload PDF to Storage
  const ext = "pdf";
  const filename = `${partnerId}/${year}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("partner-invoices")
    .upload(filename, file, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Upsert invoice record
  const { data, error } = await supabase
    .from("partner_invoices")
    .upsert(
      {
        partner_id: partnerId,
        year,
        amount,
        file_url: filename,
        uploaded_at: new Date().toISOString(),
        is_paid: false,
        paid_at: null,
        historical: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner_id,year" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
