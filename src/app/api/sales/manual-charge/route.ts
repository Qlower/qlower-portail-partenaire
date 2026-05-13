// POST /api/sales/manual-charge
//
// Ajoute manuellement une vente (virement bancaire, chèque, espèces…) qui
// n'est pas passée par Stripe. Crée une ligne attribution_rows avec un
// charge_id préfixé "manual_<timestamp>_<hash>" pour le distinguer.
//
// Sales_admin only. Lance le même scoring HubSpot que pour une vente Stripe.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifySales } from "@/lib/sales-auth";
import { scoreCharge } from "@/lib/sales-scoring";
import { inferFamily } from "@/lib/charge-classifier";
import { createHash } from "node:crypto";

export const maxDuration = 30;

interface ManualChargeBody {
  email: string;
  client_name?: string | null;
  phone?: string | null;
  amount_ttc: number; // en € TTC (entier ou float)
  payment_date: string; // ISO date ou YYYY-MM-DD
  payment_method: "virement" | "cheque" | "especes" | "autre";
  family?: string;
  description?: string | null;
  product_name?: string | null;
  note?: string | null;
}

function yearMonthFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  const r = await verifySales(request, { requireAdmin: true });
  if ("error" in r) return r.error;
  const { auth } = r;

  let body: ManualChargeBody;
  try {
    body = (await request.json()) as ManualChargeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validation
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  }
  const amount = Number(body.amount_ttc);
  if (!isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Montant invalide (>= 1 €)" }, { status: 400 });
  }
  if (!body.payment_date) {
    return NextResponse.json({ error: "Date de paiement requise" }, { status: 400 });
  }
  const validMethods = ["virement", "cheque", "especes", "autre"] as const;
  if (!validMethods.includes(body.payment_method)) {
    return NextResponse.json({ error: "Méthode de paiement invalide" }, { status: 400 });
  }

  // Build a deterministic-ish charge_id pour pouvoir dédupliquer si on re-clique
  // par erreur (même email + date + montant → même id).
  const hash = createHash("sha1")
    .update(`${body.email}|${body.payment_date}|${amount}`)
    .digest("hex")
    .slice(0, 12);
  const charge_id = `manual_${body.payment_method}_${hash}`;

  const createdAtIso = new Date(body.payment_date).toISOString();
  const yearMonth = yearMonthFromDate(createdAtIso);

  const sb = createServiceClient();

  // Skip if already exists
  const { data: existing } = await sb
    .from("attribution_rows")
    .select("charge_id")
    .eq("charge_id", charge_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Cette vente existe déjà (mêmes email + date + montant)" },
      { status: 409 },
    );
  }

  // Ensure monthly run
  const { data: existingRun } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", yearMonth)
    .maybeSingle();
  let runId: string;
  if (existingRun) {
    if (existingRun.locked) {
      return NextResponse.json(
        { error: "Le mois est verrouillé. Déverrouille-le d'abord." },
        { status: 423 },
      );
    }
    runId = existingRun.id;
  } else {
    const { data: created } = await sb
      .from("monthly_runs")
      .insert({ year_month: yearMonth, total_rows: 0, total_net_eur: 0 })
      .select("id")
      .single();
    if (!created) {
      return NextResponse.json({ error: "Impossible de créer le run mensuel" }, { status: 500 });
    }
    runId = created.id;
  }

  // Scoring HubSpot (avec lookup par téléphone si fourni)
  const scoring = await scoreCharge({
    email: body.email,
    phone: body.phone || null,
    paymentDate: createdAtIso,
  });

  // Family : prend ce que l'admin a coché, sinon devine
  const family =
    body.family && body.family.trim() ? body.family.trim() : inferFamily(body.description || body.product_name || null, amount);

  const amount_int = Math.round(amount);

  const { error: insertErr } = await sb.from("attribution_rows").insert({
    charge_id,
    customer_id: "", // pas de customer Stripe pour les paiements hors-Stripe
    email: body.email.trim().toLowerCase(),
    phone: body.phone || null,
    client_name: body.client_name?.trim() || null,
    created_at: createdAtIso,
    amount_gross_eur: amount_int,
    amount_refunded_eur: 0,
    amount_net_eur: amount_int,
    description: body.description || null,
    family,
    product_name: body.product_name || body.description || null,
    newbiz_1m: "NewBiz", // on ne peut pas inférer sans historique Stripe — par défaut NewBiz
    newbiz_3m: "NewBiz",
    auto_commercial_id: scoring.commercial_id,
    auto_score: scoring.score,
    auto_source: scoring.source,
    auto_reason: scoring.reason,
    last_efforts: scoring.last_efforts,
    run_id: runId,
    payment_method: body.payment_method,
    manual_added_by: auth.email,
    manual_note: body.note || null,
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    charge_id,
    scoring: {
      auto_commercial_id: scoring.commercial_id,
      auto_score: scoring.score,
      auto_source: scoring.source,
      auto_reason: scoring.reason,
    },
  });
}
