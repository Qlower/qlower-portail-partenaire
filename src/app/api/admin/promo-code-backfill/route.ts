// POST /api/admin/promo-code-backfill
//
// Scanne les charges Stripe récentes pour détecter celles qui utilisent un code
// promo correspondant à un partenaire, et crée les leads manquants. Sert à
// rattraper l'historique avant l'activation du matcher dans le webhook.
//
// Use case : Mélanie Quéau a payé via le code promo d'un partenaire mais
// l'attribution UTM HubSpot ne s'est pas faite (parcours offline). Le code promo
// est sur l'invoice Stripe → on peut rattraper.
//
// Paramètres (query) :
//   - days     : nb de jours à scanner (défaut 365)
//   - dry_run  : "true" pour simuler sans créer de leads (défaut false)
//   - limit    : max de charges à scanner (défaut 1000, pour éviter timeout Vercel)
//
// Réponse : { scanned, matched, created, updated, skipped, hs_synced, samples }

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";
import {
  findPartnerByStripePromoCode,
  attributeLeadFromPromoMatch,
  syncPromoAttributionToHubSpot,
} from "@/lib/promo-code-matcher";

export const maxDuration = 60;
export const runtime = "nodejs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  if (!STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 503 });
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "365", 10);
  const dryRun = searchParams.get("dry_run") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "1000", 10), 5000);

  const supabase = createServiceClient();
  const sinceUnix = Math.floor((Date.now() - days * 86400 * 1000) / 1000);

  // Budget temps : 50s max (Vercel limite à 60s, on garde 10s de marge pour le rendu)
  const startedAt = Date.now();
  const BUDGET_MS = 50_000;

  const samples: Array<{
    charge_id: string;
    email: string;
    partner_code: string;
    matched_via: string;
    action: string;
    hs_synced: boolean;
    hs_reason?: string;
  }> = [];

  let scanned = 0;
  let matched = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let hsSynced = 0;
  let lastChargeId: string | undefined;
  let timeBudgetExceeded = false;

  // Pagination Stripe : 100 par page
  let starting_after: string | undefined;
  while (scanned < limit) {
    if (Date.now() - startedAt > BUDGET_MS) {
      timeBudgetExceeded = true;
      break;
    }

    let page: Stripe.ApiList<Stripe.Charge>;
    try {
      page = await stripe.charges.list({
        limit: 100,
        created: { gte: sinceUnix },
        ...(starting_after ? { starting_after } : {}),
      });
    } catch (e) {
      return NextResponse.json(
        { error: `stripe_list_failed: ${e instanceof Error ? e.message : "unknown"}` },
        { status: 500 },
      );
    }

    if (page.data.length === 0) break;

    for (const charge of page.data) {
      if (Date.now() - startedAt > BUDGET_MS) {
        timeBudgetExceeded = true;
        break;
      }
      scanned++;
      lastChargeId = charge.id;

      if (!charge.captured) continue;
      // Stripe SDK v22 a retiré `invoice` du type Charge alors qu'il existe runtime
      const chargeAny = charge as Stripe.Charge & { invoice?: string | null };
      if (!chargeAny.invoice) continue; // pas de subscription → pas de promo code

      try {
        const match = await findPartnerByStripePromoCode(stripe, charge, supabase);
        if (!match) continue;
        matched++;

        if (dryRun) {
          samples.push({
            charge_id: charge.id,
            email: match.customer_email,
            partner_code: match.partner_code,
            matched_via: match.matched_via,
            action: "dry_run",
            hs_synced: false,
            hs_reason: "dry_run_skipped",
          });
          continue;
        }

        const leadAction = await attributeLeadFromPromoMatch(
          supabase,
          match,
          new Date(charge.created * 1000),
        );
        if (leadAction.action === "created") created++;
        else if (leadAction.action === "updated") updated++;
        else skipped++;

        const hs = await syncPromoAttributionToHubSpot(match);
        if (hs.ok) hsSynced++;

        if (samples.length < 30) {
          samples.push({
            charge_id: charge.id,
            email: match.customer_email,
            partner_code: match.partner_code,
            matched_via: match.matched_via,
            action: leadAction.action + (leadAction.reason ? `(${leadAction.reason})` : ""),
            hs_synced: hs.ok,
            hs_reason: hs.reason,
          });
        }
      } catch (e) {
        console.warn(
          `[promo-code-backfill] charge ${charge.id} error:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    if (!page.has_more || timeBudgetExceeded) break;
    starting_after = page.data[page.data.length - 1].id;
  }

  return NextResponse.json({
    dryRun,
    scanned,
    matched,
    created,
    updated,
    skipped,
    hs_synced: hsSynced,
    samples,
    time_budget_exceeded: timeBudgetExceeded,
    last_charge_id: lastChargeId,
    days,
    limit,
  });
}
