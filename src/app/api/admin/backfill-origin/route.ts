// POST /api/admin/backfill-origin?ym=YYYY-MM&token=...
//
// Backfill ponctuel : renseigne attribution_rows.origin_source / origin_detail
// pour un mois donné, en récupérant la vraie origine analytique depuis HubSpot
// (par email). Métadonnée marketing — n'affecte ni montants ni attribution.
//
// Token-guardé (one-off admin).

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { fetchOriginByEmail } from "@/lib/hubspot-origin";
import { verifyAdmin } from "@/lib/admin-auth";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const ym = searchParams.get("ym");
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) {
    return NextResponse.json({ error: "ym (YYYY-MM) requis" }, { status: 400 });
  }
  const sb = createServiceClient();

  const { data: run } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", ym)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: `Aucun run pour ${ym}` }, { status: 404 });

  // Reprenable : seulement les lignes sans origine (origin_source NULL) et positives,
  // par lots de 100. Les "non trouvé" reçoivent un sentinel 'Non renseigné' pour
  // ne pas être retraités en boucle.
  const { data: rows } = await sb
    .from("attribution_rows")
    .select("charge_id, email, amount_net_eur, auto_source")
    .eq("run_id", run.id)
    .is("origin_source", null)
    .gt("amount_net_eur", 0)
    .order("created_at")
    .limit(100);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  const bySource: Record<string, number> = {};

  for (const r of rows || []) {
    // Lignes refund ledger / négatives : pas d'origine pertinente.
    const email = (r.email || "").replace(/^\(refund\)\s*/i, "").trim();
    if ((r.amount_net_eur ?? 0) <= 0 || (r.auto_source || "").includes("refund") || !email) {
      skipped++;
      continue;
    }
    processed++;
    const origin = await fetchOriginByEmail(email);
    if (!origin) {
      // Sentinel : évite de re-tenter cette ligne à chaque relance.
      await sb.from("attribution_rows").update({ origin_source: "Non renseigné" }).eq("charge_id", r.charge_id);
      bySource["Non renseigné"] = (bySource["Non renseigné"] || 0) + 1;
      continue;
    }
    const { error } = await sb
      .from("attribution_rows")
      .update({ origin_source: origin.origin_source, origin_detail: origin.origin_detail })
      .eq("charge_id", r.charge_id);
    if (!error) {
      updated++;
      const k = origin.origin_source || "Inconnu";
      bySource[k] = (bySource[k] || 0) + 1;
    }
  }

  const more = (rows?.length || 0) >= 100;
  return NextResponse.json({ ym, processed, updated, skipped, bySource, more });
}
