import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase-server";
import { scoreCharge } from "@/lib/sales-scoring";
import { enrichCharge, type ChargeEnrichment } from "@/lib/charge-classifier";
import {
  findPartnerByStripePromoCode,
  attributeLeadFromPromoMatch,
  syncPromoAttributionToHubSpot,
} from "@/lib/promo-code-matcher";

export const maxDuration = 60;
export const runtime = "nodejs"; // need raw body for signature verification

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// Use the SDK's default API version (avoids hard-coded version mismatch
// between TS types and runtime if the published SDK lags behind).
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

interface ChargeUpsertInput {
  charge_id: string;
  email: string;
  phone: string | null;
  client_name: string | null;
  customer_id: string;
  created_at: string; // ISO
  amount_gross_eur: number;
  amount_refunded_eur: number;
  amount_net_eur: number;
  description: string | null;
  enrichment: ChargeEnrichment;
}

function yearMonthFromDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function ensureMonthlyRun(yearMonth: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (existing) return existing.id;

  // Insert a new run for this month
  const { data: created } = await sb
    .from("monthly_runs")
    .insert({ year_month: yearMonth, total_rows: 0, total_net_eur: 0 })
    .select("id")
    .single();
  return created?.id || null;
}

async function upsertCharge(input: ChargeUpsertInput): Promise<{ created: boolean; updated: boolean; skipped?: string }> {
  const sb = createServiceClient();
  // Don't process Stripe charges that are out of scope: e.g. amounts under 1€,
  // or descriptions that are "Subscription update" (renewals).
  if (input.description && input.description.toLowerCase().includes("subscription update")) {
    return { created: false, updated: false, skipped: "subscription_update" };
  }
  if (input.amount_net_eur < 1) {
    return { created: false, updated: false, skipped: "amount_too_low" };
  }

  const yearMonth = yearMonthFromDate(input.created_at);
  const runId = await ensureMonthlyRun(yearMonth);
  if (!runId) return { created: false, updated: false, skipped: "no_run" };

  // Skip if the month is locked (runs as a no-op for late events)
  const { data: run } = await sb
    .from("monthly_runs")
    .select("locked")
    .eq("id", runId)
    .maybeSingle();
  if (run?.locked) return { created: false, updated: false, skipped: "month_locked" };

  // Score the charge against HubSpot data — incl. lookup par téléphone pour
  // gérer les clients ayant plusieurs fiches HubSpot (cas Baptiste Perlin).
  const scoring = await scoreCharge({
    email: input.email,
    phone: input.phone,
    paymentDate: input.created_at,
  });

  // Upsert the row (don't overwrite override if it exists)
  const { data: existing } = await sb
    .from("attribution_rows")
    .select("charge_id, override_commercial_id")
    .eq("charge_id", input.charge_id)
    .maybeSingle();

  const baseFields = {
    customer_id: input.customer_id,
    email: input.email,
    phone: input.phone,
    client_name: input.client_name,
    created_at: input.created_at,
    amount_gross_eur: input.amount_gross_eur,
    amount_refunded_eur: input.amount_refunded_eur,
    amount_net_eur: input.amount_net_eur,
    description: input.description,
    family: input.enrichment.family,
    product_name: input.enrichment.product_name,
    newbiz_1m: input.enrichment.newbiz_1m,
    newbiz_3m: input.enrichment.newbiz_3m,
    auto_commercial_id: scoring.commercial_id,
    auto_score: scoring.score,
    auto_source: scoring.source,
    auto_reason: scoring.reason,
    last_efforts: scoring.last_efforts,
    run_id: runId,
  };

  if (existing) {
    const { error } = await sb.from("attribution_rows").update(baseFields).eq("charge_id", input.charge_id);
    if (error) return { created: false, updated: false, skipped: `update_error:${error.message}` };
    return { created: false, updated: true };
  }

  const { error } = await sb.from("attribution_rows").insert({
    charge_id: input.charge_id,
    ...baseFields,
  });
  if (error) return { created: false, updated: false, skipped: `insert_error:${error.message}` };
  return { created: true, updated: false };
}

// POST /api/webhooks/stripe
//
// Stripe webhook endpoint. Handles charge.succeeded, charge.refunded, and
// payment_intent.succeeded events. Verifies signature using STRIPE_WEBHOOK_SECRET.
export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  let result: { created?: boolean; updated?: boolean; skipped?: string } = {};

  try {
    switch (event.type) {
      case "charge.succeeded":
      case "charge.captured":
      case "charge.updated": {
        const charge = event.data.object as Stripe.Charge;
        if (!charge.captured) break;
        const email = charge.billing_details?.email || charge.receipt_email || "";
        if (!email) {
          result = { skipped: "no_email" };
          break;
        }
        const customerId = typeof charge.customer === "string" ? charge.customer : (charge.customer?.id || "");

        // Extract phone (billing_details first, fallback to Stripe customer
        // object). Used to dedupe HubSpot contacts when a person has multiple
        // fiches HubSpot (cas Baptiste Perlin).
        let phone: string | null = charge.billing_details?.phone || null;
        let clientName: string | null = charge.billing_details?.name || null;
        if ((!phone || !clientName) && customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (!("deleted" in customer) || customer.deleted !== true) {
              const c = customer as Stripe.Customer;
              if (!phone) phone = c.phone || null;
              if (!clientName) clientName = c.name || null;
            }
          } catch {
            // Customer fetch failed — non-blocking, on continue sans tél / nom
          }
        }

        // Enrichissement : family + product_name + newbiz_1m/3m
        // (récupéré via Stripe API : invoice.lines + previous charges du customer).
        // Non bloquant : si l'enrichment échoue, on continue avec des valeurs par défaut.
        let enrichment;
        try {
          enrichment = await enrichCharge(stripe, charge);
        } catch (e) {
          console.warn("[stripe-webhook] enrichment failed:", e instanceof Error ? e.message : e);
          enrichment = {
            family: "Autre",
            product_name: charge.description || null,
            newbiz_1m: "NewBiz" as const,
            newbiz_3m: "NewBiz" as const,
          };
        }

        result = await upsertCharge({
          charge_id: charge.id,
          email,
          phone,
          client_name: clientName,
          customer_id: customerId,
          created_at: new Date(charge.created * 1000).toISOString(),
          amount_gross_eur: Math.round(charge.amount / 100),
          amount_refunded_eur: Math.round((charge.amount_refunded || 0) / 100),
          amount_net_eur: Math.round((charge.amount - (charge.amount_refunded || 0)) / 100),
          description: charge.description || null,
          enrichment,
        });

        // Rattachement automatique au partenaire si un code promo Stripe matche
        // un `partners.code` (cas du client orienté par un partenaire à l'oral,
        // sans UTM). Non bloquant : si fail, on continue.
        try {
          const sb = createServiceClient();
          const match = await findPartnerByStripePromoCode(stripe, charge, sb);
          if (match) {
            const leadAction = await attributeLeadFromPromoMatch(
              sb,
              match,
              new Date(charge.created * 1000),
            );
            // Sync à HubSpot en best-effort (n'écrase pas une attribution existante)
            const hs = await syncPromoAttributionToHubSpot(match);
            console.log(
              `[stripe-webhook] promo-code attribution: charge=${charge.id} email=${match.customer_email} → partner=${match.partner_code} (${match.partner_id}) via=${match.matched_via} lead=${leadAction.action} hs=${hs.ok ? "synced" : hs.reason}`,
            );
          }
        } catch (e) {
          console.warn(
            "[stripe-webhook] promo-code matcher failed:",
            e instanceof Error ? e.message : e,
          );
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const sb = createServiceClient();
        const refunded = Math.round((charge.amount_refunded || 0) / 100);
        const net = Math.round((charge.amount - (charge.amount_refunded || 0)) / 100);

        // Check si le mois de la charge originale est verrouillé.
        // Si oui, on flag `refunded_after_lock=true` pour que l'admin voie
        // le clawback potentiel sur la paie suivante du négo (commission
        // déjà versée à l'époque mais le client a été remboursé depuis).
        const { data: rowInfo } = await sb
          .from("attribution_rows")
          .select("run_id, monthly_runs!inner(locked, year_month)")
          .eq("charge_id", charge.id)
          .maybeSingle();
        type RunInfo = { locked: boolean; year_month: string };
        const runInfo = (rowInfo as unknown as { monthly_runs?: RunInfo } | null)?.monthly_runs;
        const isMonthLocked = !!runInfo?.locked;

        const updateFields: Record<string, unknown> = {
          amount_refunded_eur: refunded,
          amount_net_eur: net,
        };
        if (isMonthLocked) {
          updateFields.refunded_after_lock = true;
          updateFields.refund_post_lock_at = new Date().toISOString();
        }

        const { error } = await sb
          .from("attribution_rows")
          .update(updateFields)
          .eq("charge_id", charge.id);

        if (!error && isMonthLocked) {
          console.warn(
            `[stripe-webhook] REFUND-AFTER-LOCK : charge ${charge.id} (mois ${runInfo?.year_month}) — ${refunded} € remboursé sur mois locked. Le négo a probablement déjà été commissionné, prévoir un clawback.`,
          );
        }
        result = error ? { skipped: error.message } : { updated: true };
        break;
      }
      default:
        result = { skipped: `event_${event.type}` };
    }
  } catch (e) {
    result = { skipped: `error:${e instanceof Error ? e.message : "unknown"}` };
  }

  return NextResponse.json({ received: true, event: event.type, ...result });
}
