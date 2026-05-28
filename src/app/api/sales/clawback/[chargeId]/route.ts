// POST /api/sales/clawback/[chargeId]
//
// Gestion des refunds-après-clôture. 3 actions possibles via body.action :
//
//   - "acknowledge_no_clawback"
//       L'admin décide que la boîte assume le refund — le négo garde son
//       commissionnement intact pour le mois d'origine. La ligne disparaît
//       du bandeau d'alerte. Réversible via "cancel".
//
//   - "apply" (body: { amount, reason })
//       L'admin décide de décommissionner. On crée une ligne NÉGATIVE dans
//       le mois COURANT (toujours ouvert) attribuée au même commercial.
//       Le montant est saisi par l'admin — pas auto-calculé (parce que le
//       taux historique de commission n'est pas tracké dans le système :
//       admin sait que Driss était à 3% en avril, il met 269*0.03 = 8,07€).
//
//   - "cancel"
//       Retire un clawback déjà appliqué OU annule un acknowledge.
//       Si applied : supprime la ligne négative du mois courant.
//       Reset le statut → NULL → la ligne réapparaît dans l'alerte.
//
// Toutes les actions sont admin only (verifySales requireAdmin) et tracées
// dans attribution_history.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";

type ClawbackAction = "acknowledge_no_clawback" | "apply" | "cancel";

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
  if (!chargeId) return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });

  let body: { action?: ClawbackAction; amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (!action || !["acknowledge_no_clawback", "apply", "cancel"].includes(action)) {
    return NextResponse.json(
      { error: "action requis : acknowledge_no_clawback | apply | cancel" },
      { status: 400 },
    );
  }

  const sb = createServiceClient();

  // Fetch la ligne d'origine + commercial attribué pour audit
  const { data: row } = await sb
    .from("attribution_rows")
    .select(
      "charge_id, email, amount_refunded_eur, refunded_after_lock, run_id, auto_commercial_id, override_commercial_id, clawback_status, clawback_charge_id",
    )
    .eq("charge_id", chargeId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Row not found" }, { status: 404 });

  const effectiveCommercialId = row.override_commercial_id || row.auto_commercial_id;

  // ───────────────────────────────────────────────────────────────────
  // CANCEL : annule un acknowledge ou retire un clawback appliqué
  // ───────────────────────────────────────────────────────────────────
  if (action === "cancel") {
    // Si une ligne négative existait → on la supprime
    if (row.clawback_charge_id) {
      await sb.from("attribution_rows").delete().eq("charge_id", row.clawback_charge_id);
    }
    await sb
      .from("attribution_rows")
      .update({
        clawback_status: null,
        clawback_applied_at: null,
        clawback_charge_id: null,
        clawback_amount_eur: null,
        clawback_decided_by_email: null,
        clawback_reason: null,
      })
      .eq("charge_id", chargeId);

    await sb.from("attribution_history").insert({
      charge_id: chargeId,
      who: auth.user_id,
      who_email: auth.email,
      from_commercial: `Clawback : ${row.clawback_status || "—"}`,
      to_commercial: "Clawback : annulé",
      comment: "Clawback retiré, ligne négative supprimée si existait",
    });
    return NextResponse.json({ ok: true, status: null });
  }

  // ───────────────────────────────────────────────────────────────────
  // ACKNOWLEDGE : la boîte assume, pas de clawback
  // ───────────────────────────────────────────────────────────────────
  if (action === "acknowledge_no_clawback") {
    if (row.clawback_status === "applied") {
      return NextResponse.json(
        { error: "Un clawback est déjà appliqué. Utilise 'cancel' d'abord." },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    await sb
      .from("attribution_rows")
      .update({
        clawback_status: "acknowledged_no_clawback",
        clawback_applied_at: now,
        clawback_decided_by_email: auth.email,
        clawback_amount_eur: 0,
      })
      .eq("charge_id", chargeId);

    await sb.from("attribution_history").insert({
      charge_id: chargeId,
      who: auth.user_id,
      who_email: auth.email,
      from_commercial: "Clawback : pending",
      to_commercial: "Clawback : la boîte assume (pas de décommissionnement)",
      comment: body.reason || null,
    });
    return NextResponse.json({ ok: true, status: "acknowledged_no_clawback" });
  }

  // ───────────────────────────────────────────────────────────────────
  // APPLY : créer la ligne négative dans le mois courant
  // ───────────────────────────────────────────────────────────────────
  if (row.clawback_status === "applied") {
    return NextResponse.json(
      { error: "Un clawback est déjà appliqué. Utilise 'cancel' pour le retirer d'abord." },
      { status: 409 },
    );
  }

  const amount = Number(body.amount);
  const reason = (body.reason || "").trim();
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount doit être un nombre positif (le montant à décommissionner en €, sans signe)" },
      { status: 400 },
    );
  }
  if (reason.length < 5) {
    return NextResponse.json(
      { error: "Le motif est obligatoire (5 caractères min)" },
      { status: 400 },
    );
  }

  // Mois courant — on crée la ligne négative dans le run_id du mois courant
  const now = new Date();
  const currentYM = yearMonthFromIso(now.toISOString());

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
  if (!currentRunId) {
    return NextResponse.json({ error: "Impossible de créer le run du mois courant" }, { status: 500 });
  }
  if (currentRun?.locked) {
    return NextResponse.json(
      { error: `Le mois courant (${currentYM}) est verrouillé. Verrouillage levé pour appliquer un clawback.` },
      { status: 423 },
    );
  }

  // Crée la ligne négative
  const clawbackChargeId = `clawback_${chargeId}_${Date.now()}`;
  const insertResult = await sb.from("attribution_rows").insert({
    charge_id: clawbackChargeId,
    email: `(clawback) ${row.email || ""}`,
    customer_id: null,
    phone: null,
    client_name: "Clawback",
    created_at: now.toISOString(),
    amount_gross_eur: -Math.abs(amount),
    amount_refunded_eur: 0,
    amount_net_eur: -Math.abs(amount),
    description: `Clawback : ${reason} (refund de ${chargeId})`,
    family: "Clawback",
    product_name: null,
    newbiz_1m: null,
    newbiz_3m: null,
    auto_commercial_id: effectiveCommercialId,
    override_commercial_id: null,
    auto_score: null,
    auto_source: "manual_clawback",
    auto_reason: `Clawback admin pour refund de ${chargeId}`,
    run_id: currentRunId,
  });

  if (insertResult.error) {
    return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
  }

  // Met à jour la ligne d'origine
  await sb
    .from("attribution_rows")
    .update({
      clawback_status: "applied",
      clawback_applied_at: now.toISOString(),
      clawback_charge_id: clawbackChargeId,
      clawback_amount_eur: amount,
      clawback_decided_by_email: auth.email,
      clawback_reason: reason,
    })
    .eq("charge_id", chargeId);

  await sb.from("attribution_history").insert({
    charge_id: chargeId,
    who: auth.user_id,
    who_email: auth.email,
    from_commercial: "Clawback : pending",
    to_commercial: `Clawback : appliqué (-${Math.round(amount)} €)`,
    comment: reason,
  });

  return NextResponse.json({
    ok: true,
    status: "applied",
    clawback_charge_id: clawbackChargeId,
    clawback_amount_eur: amount,
  });
}
