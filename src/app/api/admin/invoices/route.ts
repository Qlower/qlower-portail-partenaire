import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";

// GET /api/admin/invoices                → all invoices (latest first)
// GET /api/admin/invoices?partner_id=X   → invoices for one partner
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const supabase = createServiceClient();

  let q = supabase
    .from("partner_invoices")
    .select("*")
    .order("year", { ascending: false })
    .order("updated_at", { ascending: false });
  if (partnerId) q = q.eq("partner_id", partnerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
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
