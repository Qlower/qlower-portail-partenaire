import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/invoices                → all invoices (latest first)
// GET /api/admin/invoices?partner_id=X   → invoices for one partner
// GET /api/admin/invoices?year=2026      → filter by year (optional, combinable)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const year = searchParams.get("year");
  const supabase = createServiceClient();

  let q = supabase
    .from("partner_invoices")
    .select("*")
    .order("year", { ascending: false })
    .order("updated_at", { ascending: false });
  if (partnerId) q = q.eq("partner_id", partnerId);
  if (year) {
    const y = parseInt(year, 10);
    if (!isNaN(y)) q = q.eq("year", y);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/admin/invoices
// Body: { partner_id, year, amount?, is_paid?, notes? }
// Use cases :
//   - Créer un placeholder pour le partenaire/année qui n'existe pas encore
//   - "Marquer soldé hors facture" : amount + is_paid=true + notes pour audit
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { partner_id, year, amount, is_paid, notes, file_url } = body;
  if (!partner_id) return NextResponse.json({ error: "partner_id required" }, { status: 400 });
  if (typeof year !== "number" || isNaN(year)) {
    return NextResponse.json({ error: "year (number) required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Check si l'invoice existe déjà pour ce partenaire/année — sinon doublons
  const { data: existing } = await supabase
    .from("partner_invoices")
    .select("id")
    .eq("partner_id", partner_id)
    .eq("year", year)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `Une facture existe déjà pour ce partenaire en ${year}. Utilise PATCH ${existing.id}.` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const insert: Record<string, unknown> = {
    partner_id,
    year,
    amount: typeof amount === "number" ? amount : 0,
    is_paid: is_paid === true,
    paid_at: is_paid === true ? now : null,
    file_url: file_url || null,
    uploaded_at: file_url ? now : null,
    notes: notes || null,
    historical: false,
  };

  const { data, error } = await supabase
    .from("partner_invoices")
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/admin/invoices
// Body: { id, is_paid?, paid_at?, amount?, notes? }
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { id, is_paid, paid_at, amount, notes } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof is_paid === "boolean") {
    update.is_paid = is_paid;
    // If toggling to paid and no date provided, use now
    if (is_paid && !paid_at) update.paid_at = new Date().toISOString();
    // If toggling to unpaid, clear paid_at
    if (!is_paid) update.paid_at = null;
  }
  if (paid_at !== undefined) update.paid_at = paid_at;
  if (typeof amount === "number") update.amount = amount;
  if (typeof notes === "string") update.notes = notes;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("partner_invoices")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
