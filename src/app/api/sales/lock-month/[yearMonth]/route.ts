import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

// POST   /api/sales/lock-month/[yearMonth]   body: { lock: true | false, reason?: string }
//
// Lock or unlock a month. When locked = true, edits are blocked (the
// override API also checks `monthly_runs.locked` and refuses with 423).
// When unlocking, the reason is stored in `unlock_reason`.
//
// Sales_admin only.
export async function POST(request: NextRequest, ctx: { params: Promise<{ yearMonth: string }> }) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  const { yearMonth } = await ctx.params;
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "Invalid yearMonth (format YYYY-MM)" }, { status: 400 });
  }

  let body: { lock?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const lock = !!body.lock;

  const sb = createServiceClient();
  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: `Run ${yearMonth} not found` }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = lock
    ? { locked: true, locked_at: now, locked_by: auth.user_id, unlock_reason: null }
    : { locked: false, locked_at: null, locked_by: null, unlock_reason: body.reason || null };

  const { error } = await sb
    .from("monthly_runs")
    .update(updates)
    .eq("id", run.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to history (so the audit trail captures this too)
  await sb.from("attribution_history").insert({
    charge_id: `__monthly_run__${yearMonth}`,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: lock ? "ouvert" : "verrouillé",
    to_commercial: lock ? "verrouillé" : "ouvert",
    comment: lock ? "Mois clôturé" : `Mois rouvert${body.reason ? ` — ${body.reason}` : ""}`,
  });

  return NextResponse.json({ ok: true, year_month: yearMonth, locked: lock });
}
