// POST /api/sales/commissionable/[chargeId]
//   body: { amount: number, reason: string }
//   → Override le montant commissionnable d'une ligne attribution_rows.
//   → Trace dans attribution_history pour audit.
//
// DELETE /api/sales/commissionable/[chargeId]
//   → Retire l'override (la ligne revient à amount_net_eur pour la commission).

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
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  const reason = (body.reason || "").trim();
  if (isNaN(amount)) {
    return NextResponse.json({ error: "amount must be a number" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason est requis (audit)" }, { status: 400 });
  }

  const sb = createServiceClient();

  // Récupère le current pour log + check du mois locked
  const { data: row, error: rowErr } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, amount_net_eur, commissionable_amount_eur")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (rowErr || !row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", row.run_id)
    .maybeSingle();
  if (run?.locked) {
    return NextResponse.json(
      { error: `Le mois ${run.year_month} est verrouillé` },
      { status: 423 },
    );
  }

  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("attribution_rows")
    .update({
      commissionable_amount_eur: amount,
      commissionable_adjusted_reason: reason,
      commissionable_adjusted_by_email: auth.email,
      commissionable_adjusted_at: now,
    })
    .eq("charge_id", chargeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Audit trail dans attribution_history (utilise les colonnes existantes)
  const prev = row.commissionable_amount_eur ?? row.amount_net_eur;
  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: `Commissionable : ${Math.round(Number(prev))} €`,
    to_commercial: `Commissionable : ${Math.round(amount)} €`,
    comment: reason,
  });

  return NextResponse.json({
    ok: true,
    charge_id: chargeId,
    commissionable_amount_eur: amount,
    commissionable_adjusted_reason: reason,
    commissionable_adjusted_by_email: auth.email,
    commissionable_adjusted_at: now,
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
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  const sb = createServiceClient();

  const { data: row } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, amount_net_eur, commissionable_amount_eur")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", row.run_id)
    .maybeSingle();
  if (run?.locked) {
    return NextResponse.json(
      { error: `Le mois ${run.year_month} est verrouillé` },
      { status: 423 },
    );
  }

  const prev = row.commissionable_amount_eur ?? row.amount_net_eur;
  const { error: upErr } = await sb
    .from("attribution_rows")
    .update({
      commissionable_amount_eur: null,
      commissionable_adjusted_reason: null,
      commissionable_adjusted_by_email: null,
      commissionable_adjusted_at: null,
    })
    .eq("charge_id", chargeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: `Commissionable : ${Math.round(Number(prev))} €`,
    to_commercial: `Commissionable : ${Math.round(Number(row.amount_net_eur))} € (auto)`,
    comment: "Override retiré — retour au montant Stripe net",
  });

  return NextResponse.json({
    ok: true,
    charge_id: chargeId,
    commissionable_amount_eur: null,
  });
}
