import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { scoreCharge } from "@/lib/sales-scoring";

export const maxDuration = 60;

// POST /api/sales/rescore-month/[yearMonth]
//
// Re-scoring manuel de toutes les lignes non-override d'un mois donné.
// Utile quand on déploie une nouvelle version de l'algo de scoring et que
// les vieilles lignes (au-delà des 7 jours du cron horaire) ne sont pas
// rafraîchies automatiquement.
//
// Sales_admin only. Skip les lignes overridées (les décisions manuelles
// sont sacrées). Skip si le mois est verrouillé (sauf si force=true).
export async function POST(request: NextRequest, ctx: { params: Promise<{ yearMonth: string }> }) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;

  const { yearMonth } = await ctx.params;
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "Invalid yearMonth" }, { status: 400 });
  }

  let body: { force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  const sb = createServiceClient();
  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: `Run ${yearMonth} not found` }, { status: 404 });
  if (run.locked && !body.force) {
    return NextResponse.json({ error: "Month is locked. Pass { force: true } to override." }, { status: 423 });
  }

  // Fetch all rows in the run (without override)
  const { data: rows } = await sb
    .from("attribution_rows")
    .select("charge_id, email, phone, created_at, auto_commercial_id, auto_score")
    .eq("run_id", run.id)
    .is("override_commercial_id", null);

  let rescored = 0;
  let changed = 0;
  const errors: string[] = [];

  for (const row of rows || []) {
    try {
      const result = await scoreCharge({
        email: row.email,
        phone: row.phone,
        paymentDate: row.created_at,
      });
      rescored++;
      if (result.commercial_id !== row.auto_commercial_id || result.score !== row.auto_score) {
        await sb
          .from("attribution_rows")
          .update({
            auto_commercial_id: result.commercial_id,
            auto_score: result.score,
            auto_source: result.source,
            auto_reason: result.reason,
            last_efforts: result.last_efforts,
          })
          .eq("charge_id", row.charge_id);
        changed++;
      }
    } catch (e) {
      errors.push(`${row.charge_id}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    year_month: yearMonth,
    total: rows?.length || 0,
    rescored,
    changed,
    errors_count: errors.length,
    errors: errors.slice(0, 10),
  });
}
