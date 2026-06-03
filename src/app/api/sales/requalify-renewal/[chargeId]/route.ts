// POST /api/sales/requalify-renewal/[chargeId]   body: { reason: string }
//   → Requalifie une charge "Subscription creation" en RECONDUCTION :
//     1) commissionable_amount_eur = 0  → sortie du CA équipe ET du CA indi
//     2) copie dans subscription_renewals → comptée en "CA reconductions"
//   Cas d'usage : un abo recréé après échec CB que Stripe enregistre à tort
//   comme une création (≠ nouveau bien). Décision manuelle admin.
//
// DELETE /api/sales/requalify-renewal/[chargeId]
//   → Annule : restaure le commissionnable (retour au net Stripe) et retire
//     la ligne de subscription_renewals.
//
// sales_admin only. Bloqué si le mois est verrouillé (423).

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

interface RowInfo {
  charge_id: string;
  run_id: string;
  customer_id: string | null;
  email: string | null;
  created_at: string;
  amount_net_eur: number | null;
  commissionable_amount_eur: number | null;
}

async function loadRow(sb: ReturnType<typeof createServiceClient>, chargeId: string) {
  const { data: row } = await sb
    .from("attribution_rows")
    .select("charge_id, run_id, customer_id, email, created_at, amount_net_eur, commissionable_amount_eur")
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return { row: null as RowInfo | null, locked: false, yearMonth: "" };
  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked, year_month")
    .eq("id", (row as RowInfo).run_id)
    .maybeSingle();
  return { row: row as RowInfo, locked: !!run?.locked, yearMonth: run?.year_month || "" };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ chargeId: string }> },
) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  const { chargeId } = await ctx.params;
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = (body.reason || "").trim();
  if (!reason) return NextResponse.json({ error: "reason est requis (audit)" }, { status: 400 });

  const sb = createServiceClient();
  const { row, locked, yearMonth } = await loadRow(sb, chargeId);
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  if (locked) return NextResponse.json({ error: `Le mois ${yearMonth} est verrouillé` }, { status: 423 });

  // 1) Copie dans subscription_renewals (non commissionnable).
  await sb.from("subscription_renewals").upsert(
    {
      charge_id: row.charge_id,
      customer_id: row.customer_id,
      email: row.email,
      amount_eur: row.amount_net_eur,
      created_at: row.created_at,
      year_month: yearMonth,
      description: `Requalifié en reconduction — ${reason}`.slice(0, 300),
    },
    { onConflict: "charge_id" },
  );

  // 2) Sortie du CA : commissionnable = 0.
  const now = new Date().toISOString();
  const { error: upErr } = await sb
    .from("attribution_rows")
    .update({
      commissionable_amount_eur: 0,
      commissionable_adjusted_reason: `Reconduction (hors CA) — ${reason}`,
      commissionable_adjusted_by_email: auth.email,
      commissionable_adjusted_at: now,
    })
    .eq("charge_id", chargeId);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const prev = row.commissionable_amount_eur ?? row.amount_net_eur;
  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: `Commissionable : ${Math.round(Number(prev))} €`,
    to_commercial: "Reconduction (0 € — hors CA)",
    comment: `Requalifié en reconduction. ${reason}`,
  });

  return NextResponse.json({ ok: true, charge_id: chargeId, requalified: true });
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
  const { row, locked, yearMonth } = await loadRow(sb, chargeId);
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  if (locked) return NextResponse.json({ error: `Le mois ${yearMonth} est verrouillé` }, { status: 423 });

  // Retire de subscription_renewals.
  await sb.from("subscription_renewals").delete().eq("charge_id", chargeId);

  // Restaure le commissionnable (retour au net Stripe).
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
    from_commercial: "Reconduction (0 € — hors CA)",
    to_commercial: `Commissionable : ${Math.round(Number(row.amount_net_eur))} € (auto)`,
    comment: "Requalification annulée — retour en vente commissionnable.",
  });

  return NextResponse.json({ ok: true, charge_id: chargeId, requalified: false });
}
