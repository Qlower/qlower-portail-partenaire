// POST /api/sales/refund-ledger/[chargeId]
//
// Crée manuellement une ligne ledger (négative) dans le mois courant pour
// décompter un refund Stripe d'une vente passée. Utile quand le webhook n'a
// pas tourné (refund effectué avant le déploiement du auto-ledger) ou pour
// rejouer un cas particulier.
//
// Workflow normal pour les NOUVEAUX refunds : le webhook charge.refunded
// crée automatiquement la ligne ledger. Cet endpoint est un fallback admin.
//
// Body : { amount?: number, reason?: string, refund_id?: string }
//   - amount : montant € à décompter (défaut : amount_refunded_eur de la ligne)
//   - reason : motif (optionnel mais recommandé)
//   - refund_id : id Stripe du refund pour anti-doublon (sinon timestamp)
//
// Anti-doublon : si refund_id fourni, charge_id = `refund_<refund_id>`.
// Sinon, `refund_manual_<chargeId>_<timestamp>` (l'admin doit éviter le double-clic).

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

function yearMonthFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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

  let body: { amount?: number; reason?: string; refund_id?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sb = createServiceClient();

  const { data: row } = await sb
    .from("attribution_rows")
    .select(
      "charge_id, email, customer_id, description, amount_refunded_eur, auto_commercial_id, override_commercial_id, run_id, monthly_runs!inner(year_month, locked)",
    )
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row)
    return NextResponse.json({ error: "Row not found" }, { status: 404 });

  type RunInfo = { year_month: string; locked: boolean };
  const runInfo = (row as unknown as { monthly_runs?: RunInfo }).monthly_runs;
  const originalYearMonth = runInfo?.year_month;
  if (!originalYearMonth)
    return NextResponse.json(
      { error: "Original year_month introuvable" },
      { status: 500 },
    );

  // On garde la trace du négo de la vente d'origine en auto_reason pour
  // l'audit, mais on N'ATTRIBUE PAS la ligne ledger (NULL). L'admin
  // décidera ensuite via la modale décommissionnement.
  const originalCommercialId =
    (row as { override_commercial_id: string | null; auto_commercial_id: string | null }).override_commercial_id ||
    (row as { auto_commercial_id: string | null }).auto_commercial_id;

  const amount = Number(body.amount) || Number((row as { amount_refunded_eur: number | null }).amount_refunded_eur || 0);
  if (!amount || amount <= 0)
    return NextResponse.json(
      { error: "amount doit être > 0 (€)" },
      { status: 400 },
    );

  const now = new Date();
  const currentYM = yearMonthFromIso(now.toISOString());

  if (currentYM === originalYearMonth)
    return NextResponse.json(
      {
        error: `La vente est dans le mois courant (${currentYM}) — le refund est déjà décompté via amount_net_eur. Pas besoin de ledger.`,
      },
      { status: 400 },
    );

  // Trouve ou crée le run du mois courant
  const { data: currentRun } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", currentYM)
    .maybeSingle();
  let currentRunId = currentRun?.id;
  if (!currentRunId) {
    const { data: created } = await sb
      .from("monthly_runs")
      .insert({ year_month: currentYM, total_rows: 0, total_net_eur: 0 })
      .select("id")
      .single();
    currentRunId = created?.id;
  }
  if (!currentRunId)
    return NextResponse.json(
      { error: "Impossible de créer le run du mois courant" },
      { status: 500 },
    );
  if (currentRun?.locked)
    return NextResponse.json(
      { error: `Mois courant ${currentYM} verrouillé.` },
      { status: 423 },
    );

  const ledgerChargeId = body.refund_id
    ? `refund_${body.refund_id}`
    : `refund_manual_${chargeId}_${Date.now()}`;

  // Anti-doublon
  const { data: existing } = await sb
    .from("attribution_rows")
    .select("charge_id")
    .eq("charge_id", ledgerChargeId)
    .maybeSingle();
  if (existing)
    return NextResponse.json(
      { error: "Ce refund a déjà été décompté", existing: ledgerChargeId },
      { status: 409 },
    );

  const reason = (body.reason || "").trim();
  const description = `Refund manuel sur vente ${chargeId} (mois d'origine ${originalYearMonth})${reason ? ` — ${reason}` : ""}`;

  const insertRes = await sb.from("attribution_rows").insert({
    charge_id: ledgerChargeId,
    email: `(refund) ${(row as { email: string | null }).email || ""}`,
    customer_id: (row as { customer_id: string | null }).customer_id,
    phone: null,
    client_name: "Refund manuel",
    created_at: now.toISOString(),
    amount_gross_eur: -Math.abs(amount),
    amount_refunded_eur: 0,
    amount_net_eur: -Math.abs(amount),
    description: description.slice(0, 500),
    family: "Refund",
    product_name: null,
    newbiz_1m: null,
    newbiz_3m: null,
    // NON ATTRIBUÉ par défaut : le CA équipe baisse, aucun négo n'est
    // impacté. L'admin décide ensuite via la modale décommissionnement.
    auto_commercial_id: null,
    override_commercial_id: null,
    auto_score: null,
    auto_source: "manual_refund_ledger",
    auto_reason: `Refund décompté manuellement par admin ${auth.email} depuis vente ${chargeId} (originellement attribuée en ${originalYearMonth}${originalCommercialId ? ` au négo ${originalCommercialId}` : ""}). Non attribué — décision admin requise pour décommissionner un négo.`,
    run_id: currentRunId,
  });

  if (insertRes.error)
    return NextResponse.json(
      { error: insertRes.error.message },
      { status: 500 },
    );

  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: "Refund",
    to_commercial: `Refund ledger : -${Math.round(amount)} € sur ${currentYM}`,
    comment: reason || null,
  });

  return NextResponse.json({
    ok: true,
    ledger_charge_id: ledgerChargeId,
    amount_eur: amount,
    year_month: currentYM,
  });
}
