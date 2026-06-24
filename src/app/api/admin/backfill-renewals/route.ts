// POST /api/admin/backfill-renewals?ym=YYYY-MM&token=...
//
// Backfill ponctuel : récupère depuis Stripe toutes les charges "Subscription
// update" (reconductions d'abonnement) d'un mois et les enregistre dans la
// table dédiée subscription_renewals. NON commissionnable — n'écrit jamais
// dans attribution_rows.
//
// Token-guardé (one-off admin).

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase-server";
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
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!key) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  const stripe = new Stripe(key);
  const sb = createServiceClient();

  const [y, m] = ym.split("-").map(Number);
  const gte = Math.floor(Date.UTC(y, m - 1, 1) / 1000);
  const lte = Math.floor(Date.UTC(y, m, 1) / 1000) - 1;

  let scanned = 0;
  let found = 0;
  let inserted = 0;
  let total = 0;
  // Reprenable : on reprend la pagination Stripe via ?after=<charge_id> et on
  // s'arrête sous ~45 s pour ne jamais dépasser la limite de 60 s.
  let startingAfter: string | undefined = searchParams.get("after") || undefined;
  let more = false;
  const started = Date.now();

  for (let page = 0; page < 200; page++) {
    const list = await stripe.charges.list({
      created: { gte, lte },
      limit: 100,
      starting_after: startingAfter,
    });
    for (const c of list.data) {
      scanned++;
      if (!c.captured) continue;
      const desc = (c.description || "").toLowerCase();
      if (!desc.includes("subscription update")) continue;
      const amount = Math.round((c.amount - (c.amount_refunded || 0)) / 100);
      if (amount < 1) continue;
      found++;
      const email = c.billing_details?.email || c.receipt_email || "";
      const customerId = typeof c.customer === "string" ? c.customer : c.customer?.id || "";
      const { error } = await sb.from("subscription_renewals").upsert(
        {
          charge_id: c.id,
          customer_id: customerId,
          email,
          amount_eur: amount,
          created_at: new Date(c.created * 1000).toISOString(),
          year_month: ym,
          description: c.description || null,
        },
        { onConflict: "charge_id" },
      );
      if (!error) {
        inserted++;
        total += amount;
      }
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
    if (!startingAfter) break;
    if (Date.now() - started > 45000) {
      more = true;
      break;
    }
  }

  return NextResponse.json({ ym, scanned, found, inserted, total_eur: total, after: startingAfter, more });
}
