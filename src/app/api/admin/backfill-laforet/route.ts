// Rétro-tag des abonnements Laforêt (marque grise) déjà en base.
//
// POST /api/admin/backfill-laforet   body: { since?: "2026-06-01", limit?: 300, dry_run?: boolean }
//
// Parcourt attribution_rows (charges réelles, mois >= since, pas encore
// taguées "Abo Laforet"), récupère le produit Stripe de chaque charge, et si
// c'est un produit Laforêt :
//   - family = "Abo Laforet"            → hors objectifs / hors commissions + label
//   - auto/override_commercial_id = null → plus aucun commercial crédité
//   - auto_source/reason = libellé explicite
//
// dry_run:true → ne modifie rien, retourne juste ce qui SERAIT tagué.
// Signale les mois VERROUILLÉS touchés (impact rétroactif sur un mois clôturé).
// Auth : admin (cookie) ou sales_admin. Idempotent, borné par time budget.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { fetchProductInfo } from "@/lib/charge-classifier";
import { LAFORET_FAMILY, LAFORET_PRODUCT_IDS } from "@/lib/objective-scope";

export const maxDuration = 60;
export const runtime = "nodejs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

async function verifyAdminOrSalesAdmin(
  request: NextRequest,
): Promise<{ ok: true } | { ok: false; error: NextResponse }> {
  const adminCheck = await verifyAdmin(request);
  if (!adminCheck.error) return { ok: true };
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const role = (user?.user_metadata as Record<string, unknown> | undefined)?.internal_role;
  if (role === "sales_admin") return { ok: true };
  return { ok: false, error: adminCheck.error };
}

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const auth = await verifyAdminOrSalesAdmin(request);
  if (!auth.ok) return auth.error;

  let body: { since?: string; limit?: number; dry_run?: boolean; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional
  }
  const since = body.since || "2026-06-01";
  const limit = Math.max(1, Math.min(1000, body.limit || 300));
  const dryRun = !!body.dry_run;
  const emailFilter = (body.email || "").trim().toLowerCase();
  const debug = !!(body as { debug?: boolean }).debug;

  const sb = createServiceClient();
  const start = Date.now();
  const TIME_BUDGET_MS = 45_000;

  // Charges réelles à examiner : pas déjà taguées Laforet, pas des lignes ledger
  // de refund, sur un mois >= since. On joint le run pour connaître le verrou.
  let q = sb
    .from("attribution_rows")
    .select("charge_id, created_at, family, email, monthly_runs!inner(year_month, locked)")
    .gte("created_at", `${since}T00:00:00Z`)
    .neq("family", LAFORET_FAMILY)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (emailFilter) q = q.ilike("email", emailFilter);
  const { data: rows } = await q;

  type Row = {
    charge_id: string;
    created_at: string;
    family: string | null;
    email: string | null;
    monthly_runs?: { year_month: string; locked: boolean };
  };
  const candidates = ((rows as unknown as Row[]) || []).filter(
    (r) => r.charge_id && !r.charge_id.startsWith("refund_") && !r.charge_id.startsWith("manual_"),
  );

  const stats = {
    since,
    dry_run: dryRun,
    examined: 0,
    tagged: [] as Array<{ charge_id: string; year_month: string; locked: boolean }>,
    locked_months_touched: new Set<string>(),
    errors: [] as Array<{ charge_id: string; error: string }>,
    time_budget_exceeded: false,
  };
  // Diagnostic : compte les IDs produits Stripe rencontrés (pour comprendre
  // pourquoi rien ne matche — ex. produit Laforet non listé dans les 5 IDs).
  const productSeen = new Map<string, number>();
  // Détail par charge (utile surtout quand on cible un email précis).
  const perCharge: Array<{ charge_id: string; email: string | null; product_ids: string[]; is_laforet: boolean }> = [];
  const debugDump: Array<Record<string, unknown>> = [];

  for (const r of candidates) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      stats.time_budget_exceeded = true;
      break;
    }
    stats.examined++;
    try {
      const charge = await stripe.charges.retrieve(r.charge_id);

      // DEBUG : dump la structure brute de la 1ere ligne de facture pour
      // comprendre ou est range l'id produit (structure Stripe variable).
      if (debug && debugDump.length < 3) {
        const chAny = charge as unknown as { invoice?: string | null };
        const invId = chAny.invoice || null;
        let lineDump: unknown = null;
        let subDump: unknown = null;
        if (invId && typeof invId === "string") {
          try {
            const inv = await stripe.invoices.retrieve(invId, {
              expand: ["lines.data.price.product", "lines.data.pricing.price_details"],
            });
            const l0 = (inv.lines?.data?.[0] || null) as unknown as Record<string, unknown> | null;
            const invAny = inv as unknown as { subscription?: string | null };
            if (l0) {
              lineDump = {
                keys: Object.keys(l0),
                description: l0.description,
                price: l0.price,
                pricing: l0.pricing,
                plan: (l0 as { plan?: unknown }).plan,
              };
            }
            // Fallback : via la subscription (souvent la source fiable du produit)
            if (invAny.subscription && typeof invAny.subscription === "string") {
              const sub = await stripe.subscriptions.retrieve(invAny.subscription, {
                expand: ["items.data.price.product"],
              });
              subDump = (sub.items?.data || []).map((it) => {
                const price = it.price as unknown as { id?: string; product?: unknown };
                return { price_id: price?.id, product: price?.product };
              });
            }
          } catch (e) {
            lineDump = { error: e instanceof Error ? e.message : "unknown" };
          }
        }
        debugDump.push({ charge_id: r.charge_id, email: r.email, invoice_id: invId, line0: lineDump, subscription_items: subDump });
      }

      const { product_ids } = await fetchProductInfo(stripe, charge);
      const isLaforet = product_ids.some((id) => LAFORET_PRODUCT_IDS.has(id));
      // Diagnostic
      for (const pid of product_ids) productSeen.set(pid, (productSeen.get(pid) || 0) + 1);
      if (emailFilter || perCharge.length < 20) {
        perCharge.push({ charge_id: r.charge_id, email: r.email, product_ids, is_laforet: isLaforet });
      }
      if (!isLaforet) continue;

      const ym = r.monthly_runs?.year_month || "";
      const locked = !!r.monthly_runs?.locked;
      if (locked) stats.locked_months_touched.add(ym);
      stats.tagged.push({ charge_id: r.charge_id, year_month: ym, locked });

      if (!dryRun) {
        const { error } = await sb
          .from("attribution_rows")
          .update({
            family: LAFORET_FAMILY,
            auto_commercial_id: null,
            override_commercial_id: null,
            auto_score: 0,
            auto_source: "Abo Laforet (hors objectifs)",
            auto_reason: "Abonnement marque grise Laforêt — hors objectifs et hors commissions (rétro-tag).",
          })
          .eq("charge_id", r.charge_id);
        if (error) stats.errors.push({ charge_id: r.charge_id, error: error.message });
      }
    } catch (e) {
      stats.errors.push({ charge_id: r.charge_id, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({
    ok: true,
    duration_ms: Date.now() - start,
    ...stats,
    tagged_count: stats.tagged.length,
    locked_months_touched: [...stats.locked_months_touched],
    product_ids_seen: [...productSeen.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count, is_laforet: LAFORET_PRODUCT_IDS.has(id) })),
    laforet_ids_configured: [...LAFORET_PRODUCT_IDS],
    sample: perCharge,
    debug_dump: debugDump,
  });
}
