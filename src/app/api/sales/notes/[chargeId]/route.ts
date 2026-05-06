import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

// POST /api/sales/notes/[chargeId]
// body: { text: string }
// Appends a note to the charge. Sales can write on rows attributed to them
// (auto OR override matches their commercial_id). Sales_admin can write on
// any row.
export async function POST(request: NextRequest, ctx: { params: Promise<{ chargeId: string }> }) {
  const r = await verifySales(request);
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Empty note" }, { status: 400 });
  if (text.length > 4000) {
    return NextResponse.json({ error: "Note too long (max 4000 chars)" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Authorisation: sales can only write on their own rows; admin on any
  if (auth.internal_role === "sales") {
    if (!auth.commercial_id) {
      return NextResponse.json({ error: "No commercial_id linked to your account" }, { status: 403 });
    }
    const { data: row } = await sb
      .from("attribution_rows")
      .select("auto_commercial_id, override_commercial_id")
      .eq("charge_id", chargeId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
    const effective = row.override_commercial_id || row.auto_commercial_id;
    if (effective !== auth.commercial_id) {
      return NextResponse.json({ error: "Not your row" }, { status: 403 });
    }
  }

  const { data: inserted, error } = await sb
    .from("attribution_notes")
    .insert({
      charge_id: chargeId,
      author_id: auth.user_id,
      author_email: auth.email,
      text,
    })
    .select("id, when_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    note: { id: inserted.id, charge_id: chargeId, author: auth.email, when_at: inserted.when_at, text },
  });
}
