// POST /api/admin/backfill-client-status?ym=YYYY-MM&token=...
//
// Backfill ponctuel : recalcule attribution_rows.client_status pour un mois
// donné, à partir de l'historique Stripe du client (même logique qu'à
// l'ingestion). Sert à rattraper les charges ingérées avant l'ajout de la
// colonne. Métadonnée non commissionnable — n'affecte ni les montants ni
// l'attribution.
//
// Token-guardé (one-off admin), pas d'auth cookie requise pour pouvoir
// l'appeler en curl.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase-server";
import { inferNewBiz } from "@/lib/charge-classifier";

export const maxDuration = 60;
export const runtime = "nodejs";

const BACKFILL_TOKEN = "qlower-backfill-client-status-2026";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== BACKFILL_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ym = searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "ym (YYYY-MM) requis" }, { status: 400 });
  }
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  const stripe = new Stripe(key);
  const sb = createServiceClient();

  const { data: run } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", ym)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: `Aucun run pour ${ym}` }, { status: 404 });

  const { data: rows } = await sb
    .from("attribution_rows")
    .select("charge_id, customer_id, created_at, amount_net_eur, auto_source")
    .eq("run_id", run.id);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const byStatus: Record<string, number> = {};

  for (const r of rows || []) {
    // On ignore les lignes refund ledger / négatives : statut client non pertinent.
    if ((r.amount_net_eur ?? 0) <= 0 || (r.auto_source || "").includes("refund")) {
      skipped++;
      continue;
    }
    if (!r.customer_id) {
      skipped++;
      continue;
    }
    processed++;
    // Pseudo-charge minimale : inferNewBiz n'utilise que id / created / customer.
    const pseudoCharge = {
      id: r.charge_id,
      created: Math.floor(new Date(r.created_at).getTime() / 1000),
      customer: r.customer_id,
    } as unknown as Stripe.Charge;
    let status: string = "Inconnu";
    try {
      const res = await inferNewBiz(stripe, pseudoCharge);
      status = res.client_status;
    } catch {
      status = "Inconnu";
    }
    const { error } = await sb
      .from("attribution_rows")
      .update({ client_status: status })
      .eq("charge_id", r.charge_id);
    if (!error) {
      updated++;
      byStatus[status] = (byStatus[status] || 0) + 1;
    }
  }

  return NextResponse.json({ ym, processed, updated, skipped, byStatus });
}
