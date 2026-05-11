import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { scoreCharge } from "@/lib/sales-scoring";

export const maxDuration = 60;

// POST /api/sales/rescore-month/[yearMonth]
//
// Re-scoring manuel chunked d'un mois donné. Le serverless Vercel coupe à 60s
// donc on traite par batch (par défaut 20 lignes) et le client boucle.
//
// Body: { offset?: number, limit?: number, force?: boolean }
//   - offset : index de départ dans la liste triée par created_at desc
//   - limit  : nb max de lignes à traiter dans cet appel (défaut 20)
//   - force  : autorise le rescore même si le mois est verrouillé
//
// Renvoie : { total, processed, rescored, changed, errors_count, errors[], next_offset }
//   - next_offset === null quand c'est fini
//
// Sales_admin only. Skip les lignes overridées (décisions manuelles sacrées).
export async function POST(request: NextRequest, ctx: { params: Promise<{ yearMonth: string }> }) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;

  const { yearMonth } = await ctx.params;
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: "Invalid yearMonth" }, { status: 400 });
  }

  let body: { offset?: number; limit?: number; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const offset = Math.max(0, body.offset || 0);
  const limit = Math.max(1, Math.min(50, body.limit || 20));

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

  // Fetch all rows in the run (without override), ordered desc for stable pagination
  const { data: rows, count } = await sb
    .from("attribution_rows")
    .select("charge_id, email, phone, created_at, auto_commercial_id, auto_score", { count: "exact" })
    .eq("run_id", run.id)
    .is("override_commercial_id", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const total = count || 0;
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

  const processedSoFar = offset + (rows?.length || 0);
  const next_offset = processedSoFar < total ? processedSoFar : null;

  return NextResponse.json({
    ok: true,
    year_month: yearMonth,
    total,
    batch_size: rows?.length || 0,
    rescored,
    changed,
    errors_count: errors.length,
    errors: errors.slice(0, 5),
    offset,
    next_offset,
  });
}
