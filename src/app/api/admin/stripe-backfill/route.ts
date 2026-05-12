// Backfill historique des charges Stripe.
//
// POST /api/admin/stripe-backfill   body: { since: "2026-05-01", limit?: 200 }
//
// Charge depuis Stripe toutes les `charge.succeeded` captured créées >= since.
// Pour chaque, applique le même pipeline que le webhook live :
//   - Extraction email / phone / client_name
//   - Enrichment (family, product_name, newbiz_1m, newbiz_3m)
//   - Scoring HubSpot (Modjo / RDV / Aircall + lookup par téléphone)
//   - Upsert dans attribution_rows
//
// Skip les charges déjà présentes en DB (idempotent par charge_id).
// Auth : admin email OU sales_admin.
// maxDuration 60s — pour Mai courant on a quelques dizaines de charges max,
// ça tient. Sinon paginer côté client en plusieurs appels avec `since` glissant.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { scoreCharge } from "@/lib/sales-scoring";
import { enrichCharge } from "@/lib/charge-classifier";

export const maxDuration = 60;
export const runtime = "nodejs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

async function verifyAdminOrSalesAdmin(
  request: NextRequest,
): Promise<{ ok: true; email: string } | { ok: false; error: NextResponse }> {
  const adminCheck = await verifyAdmin(request);
  if (!adminCheck.error) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    return { ok: true, email: user?.email || "admin" };
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.user_metadata as Record<string, unknown> | undefined)?.internal_role;
  if (role === "sales_admin") return { ok: true, email: user?.email || "sales_admin" };
  return { ok: false, error: adminCheck.error };
}

function yearMonthFromDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ensureMonthlyRun(yearMonth: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await sb
    .from("monthly_runs")
    .insert({ year_month: yearMonth, total_rows: 0, total_net_eur: 0 })
    .select("id")
    .single();
  return created?.id || null;
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const auth = await verifyAdminOrSalesAdmin(request);
  if (!auth.ok) return auth.error;

  let body: { since?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    // optional
  }
  const since = body.since || "2026-05-01";
  const limit = Math.max(1, Math.min(500, body.limit || 200));

  const sinceTs = Math.floor(new Date(since).getTime() / 1000);
  if (!sinceTs || isNaN(sinceTs)) {
    return NextResponse.json({ error: "Invalid 'since' date" }, { status: 400 });
  }

  const sb = createServiceClient();
  const start = Date.now();
  const stats = {
    fetched: 0,
    skipped_existing: 0,
    skipped_other: [] as Array<{ charge_id: string; reason: string }>,
    created: 0,
    updated: 0,
    errors: [] as Array<{ charge_id: string; error: string }>,
  };

  // Paginate stripe.charges.list
  let cursor: string | undefined;
  outer: while (stats.fetched < limit) {
    const page = await stripe.charges.list({
      created: { gte: sinceTs },
      limit: 100,
      starting_after: cursor,
    });
    if (!page.data.length) break;

    for (const charge of page.data) {
      if (stats.fetched >= limit) break outer;
      stats.fetched++;

      try {
        if (!charge.captured) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "not_captured" });
          continue;
        }
        const email = charge.billing_details?.email || charge.receipt_email || "";
        if (!email) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "no_email" });
          continue;
        }
        const customerId =
          typeof charge.customer === "string" ? charge.customer : charge.customer?.id || "";

        // Skip if already exists in DB
        const { data: existing } = await sb
          .from("attribution_rows")
          .select("charge_id, override_commercial_id")
          .eq("charge_id", charge.id)
          .maybeSingle();
        if (existing) {
          stats.skipped_existing++;
          continue;
        }

        // Extract phone + client_name
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
            // ignore
          }
        }

        // Filter out of scope
        const amount_net_eur = Math.round((charge.amount - (charge.amount_refunded || 0)) / 100);
        const description = charge.description || null;
        if (description && description.toLowerCase().includes("subscription update")) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "subscription_update" });
          continue;
        }
        if (amount_net_eur < 1) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "amount_too_low" });
          continue;
        }

        // Enrich
        let enrichment;
        try {
          enrichment = await enrichCharge(stripe, charge);
        } catch {
          enrichment = {
            family: "Autre",
            product_name: description,
            newbiz_1m: "NewBiz" as const,
            newbiz_3m: "NewBiz" as const,
          };
        }

        // Score
        const createdAtIso = new Date(charge.created * 1000).toISOString();
        const yearMonth = yearMonthFromDate(createdAtIso);
        const runId = await ensureMonthlyRun(yearMonth);
        if (!runId) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "no_run" });
          continue;
        }
        const { data: run } = await sb
          .from("monthly_runs")
          .select("locked")
          .eq("id", runId)
          .maybeSingle();
        if (run?.locked) {
          stats.skipped_other.push({ charge_id: charge.id, reason: "month_locked" });
          continue;
        }

        const scoring = await scoreCharge({
          email,
          phone,
          paymentDate: createdAtIso,
        });

        const { error: insertErr } = await sb.from("attribution_rows").insert({
          charge_id: charge.id,
          customer_id: customerId,
          email,
          phone,
          client_name: clientName,
          created_at: createdAtIso,
          amount_gross_eur: Math.round(charge.amount / 100),
          amount_refunded_eur: Math.round((charge.amount_refunded || 0) / 100),
          amount_net_eur,
          description,
          family: enrichment.family,
          product_name: enrichment.product_name,
          newbiz_1m: enrichment.newbiz_1m,
          newbiz_3m: enrichment.newbiz_3m,
          auto_commercial_id: scoring.commercial_id,
          auto_score: scoring.score,
          auto_source: scoring.source,
          auto_reason: scoring.reason,
          last_efforts: scoring.last_efforts,
          run_id: runId,
        });

        if (insertErr) {
          stats.errors.push({ charge_id: charge.id, error: insertErr.message });
        } else {
          stats.created++;
        }
      } catch (e) {
        stats.errors.push({
          charge_id: charge.id,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    if (!page.has_more) break;
    cursor = page.data[page.data.length - 1].id;
  }

  return NextResponse.json({
    ok: true,
    since,
    duration_ms: Date.now() - start,
    ...stats,
  });
}
