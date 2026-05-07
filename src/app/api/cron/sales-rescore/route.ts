import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { scoreCharge } from "@/lib/sales-scoring";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "";

// GET /api/cron/sales-rescore
//
// Hourly cron that re-scores attribution_rows in unlocked months created in
// the last 7 days. Catches HubSpot analytics latency: when a charge fires
// before HubSpot has populated `hs_analytics_source_data_2`, the initial
// score may be wrong. Re-scoring later picks up the late-arriving data.
//
// Skips rows that already have an override (manual decisions are sacred).
// Skips rows in locked months.
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = createServiceClient();

  // Find recent rows in unlocked months
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: rows } = await sb
    .from("attribution_rows")
    .select(
      "charge_id, email, phone, created_at, override_commercial_id, auto_commercial_id, auto_score, run_id",
    )
    .gte("created_at", sevenDaysAgo)
    .is("override_commercial_id", null)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ scanned: 0, rescored: 0, changed: 0 });
  }

  // Filter out rows whose run is locked
  const runIds = [...new Set(rows.map((r) => r.run_id))];
  const { data: runs } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .in("id", runIds);
  const lockedRunIds = new Set((runs || []).filter((r) => r.locked).map((r) => r.id));
  const eligible = rows.filter((r) => !lockedRunIds.has(r.run_id));

  let rescored = 0;
  let changed = 0;
  const errors: string[] = [];

  for (const row of eligible) {
    try {
      const result = await scoreCharge({
        email: row.email,
        phone: row.phone,
        paymentDate: row.created_at,
      });
      rescored++;
      const newCid = result.commercial_id;
      const oldCid = row.auto_commercial_id;
      // Update only if it actually changed (saves writes)
      if (newCid !== oldCid || (result.score !== row.auto_score)) {
        await sb
          .from("attribution_rows")
          .update({
            auto_commercial_id: newCid,
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
    scanned: rows.length,
    eligible: eligible.length,
    locked_skipped: rows.length - eligible.length,
    rescored,
    changed,
    error_count: errors.length,
    errors: errors.slice(0, 10),
  });
}
