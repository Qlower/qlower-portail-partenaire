// POST   /api/sales/decommission/[chargeId]
//   body: { commercial_id: string, amount_eur: number, reason: string }
//   → Décide qu'un négo doit être décommissionné pour cette ligne refund.
//   → Le CA du négo ne bouge pas (la ligne ledger reste non attribuée).
//   → Le montant est tracké dans decommission_amount_eur pour être retenu
//     sur sa prochaine paie commission (calcul admin manuel).
//
// DELETE /api/sales/decommission/[chargeId]
//   → Retire la décision de décommissionnement.
//
// Admin only. Audit dans attribution_history.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ chargeId: string }> },
) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId)
    return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { commercial_id?: string; amount_eur?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const commercialId = (body.commercial_id || "").trim();
  const amount = Number(body.amount_eur);
  const reason = (body.reason || "").trim();

  if (!commercialId)
    return NextResponse.json(
      { error: "commercial_id requis" },
      { status: 400 },
    );
  if (!amount || amount <= 0)
    return NextResponse.json(
      {
        error:
          "amount_eur doit être > 0 (montant à retenir sur la paie commission du négo)",
      },
      { status: 400 },
    );
  if (reason.length < 5)
    return NextResponse.json(
      { error: "Motif obligatoire (5 caractères min, pour audit)" },
      { status: 400 },
    );

  const sb = createServiceClient();

  const { data: row } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, auto_source, decommission_commercial_id")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  // Check : on n'autorise décommissionnement QUE sur les lignes refund ledger.
  const isRefundLine =
    row.auto_source === "stripe_refund_ledger" ||
    row.auto_source === "manual_refund_ledger";
  if (!isRefundLine)
    return NextResponse.json(
      {
        error:
          "Le décommissionnement n'est applicable que sur les lignes refund ledger",
      },
      { status: 400 },
    );

  // Check négo existe
  const { data: commercial } = await sb
    .from("commercials")
    .select("id, name")
    .eq("id", commercialId)
    .maybeSingle();
  if (!commercial)
    return NextResponse.json(
      { error: "Négo introuvable" },
      { status: 404 },
    );

  // Check mois locked
  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", row.run_id)
    .maybeSingle();
  if (run?.locked)
    return NextResponse.json(
      { error: `Le mois ${run.year_month} est verrouillé` },
      { status: 423 },
    );

  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("attribution_rows")
    .update({
      decommission_commercial_id: commercialId,
      decommission_amount_eur: amount,
      decommission_reason: reason,
      decommission_set_by_email: auth.email,
      decommission_set_at: now,
    })
    .eq("charge_id", chargeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial:
      row.decommission_commercial_id
        ? `Décommissionnement : ${row.decommission_commercial_id}`
        : "Décommissionnement : aucun",
    to_commercial: `Décommissionnement : ${commercial.name} (-${Math.round(amount)} € sur paie)`,
    comment: reason,
  });

  return NextResponse.json({
    ok: true,
    decommission_commercial_id: commercialId,
    decommission_amount_eur: amount,
    decommission_reason: reason,
    decommission_set_by_email: auth.email,
    decommission_set_at: now,
  });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ chargeId: string }> },
) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId)
    return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  const sb = createServiceClient();

  const { data: row } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, decommission_commercial_id, decommission_amount_eur")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", row.run_id)
    .maybeSingle();
  if (run?.locked)
    return NextResponse.json(
      { error: `Le mois ${run.year_month} est verrouillé` },
      { status: 423 },
    );

  const prevCommId = row.decommission_commercial_id;
  const prevAmt = row.decommission_amount_eur;

  const { error: upErr } = await sb
    .from("attribution_rows")
    .update({
      decommission_commercial_id: null,
      decommission_amount_eur: null,
      decommission_reason: null,
      decommission_set_by_email: null,
      decommission_set_at: null,
    })
    .eq("charge_id", chargeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: prevCommId
      ? `Décommissionnement : ${prevCommId} (-${Math.round(Number(prevAmt || 0))} €)`
      : "Décommissionnement : —",
    to_commercial: "Décommissionnement : retiré (la boîte assume)",
    comment: "Décision admin retirée",
  });

  return NextResponse.json({
    ok: true,
    decommission_commercial_id: null,
  });
}
