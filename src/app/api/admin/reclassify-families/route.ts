// Reclasse la FAMILLE des charges déjà en base à partir du vrai produit Stripe
// (au lieu de l'ancienne heuristique regex/montant).
//
// POST /api/admin/reclassify-families  body: { since?, limit?, dry_run?, email? }
//
// Pour chaque charge (mois >= since, hors lignes refund/manual) : lit l'id
// produit Stripe (facture OU checkout session) → famille cible via
// product-families. Si c'est un produit Laforêt : famille "Abo Laforet" +
// attribution neutralisée. Met à jour seulement si la famille change.
//
// dry_run:true → n'écrit rien, retourne les changements qui seraient faits.
// Idempotent, borné par un budget temps (relancer si time_budget_exceeded).
// Auth : admin (cookie) ou sales_admin.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyAdmin } from "@/lib/admin-auth";
import { fetchProductInfo } from "@/lib/charge-classifier";
import { LAFORET_FAMILY, LAFORET_PRODUCT_IDS } from "@/lib/objective-scope";
import { familyForProductIds, productNameForIds } from "@/lib/product-families";

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
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const auth = await verifyAdminOrSalesAdmin(request);
  if (!auth.ok) return auth.error;

  let body: { since?: string; limit?: number; dry_run?: boolean; email?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional
  }
  const since = body.since || "2026-08-01";
  const limit = Math.max(1, Math.min(1000, body.limit || 300));
  const dryRun = !!body.dry_run;
  const emailFilter = (body.email || "").trim().toLowerCase();

  const sb = createServiceClient();
  const start = Date.now();
  const TIME_BUDGET_MS = 45_000;

  let q = sb
    .from("attribution_rows")
    .select("charge_id, created_at, family, product_name, email, monthly_runs!inner(year_month, locked)")
    .gte("created_at", `${since}T00:00:00Z`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (emailFilter) q = q.ilike("email", emailFilter);
  const { data: rows } = await q;

  type Row = {
    charge_id: string;
    created_at: string;
    family: string | null;
    product_name: string | null;
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
    changed: 0,
    changes: [] as Array<{ charge_id: string; from: string | null; to: string; email: string | null }>,
    by_transition: {} as Record<string, number>,
    errors: [] as Array<{ charge_id: string; error: string }>,
    time_budget_exceeded: false,
  };

  for (const r of candidates) {
    if (Date.now() - start > TIME_BUDGET_MS) {
      stats.time_budget_exceeded = true;
      break;
    }
    stats.examined++;
    try {
      const charge = await stripe.charges.retrieve(r.charge_id);
      const { product_ids } = await fetchProductInfo(stripe, charge);
      const isLaforet = product_ids.some((id) => LAFORET_PRODUCT_IDS.has(id));
      const targetFamily = isLaforet ? LAFORET_FAMILY : familyForProductIds(product_ids);
      const targetName = productNameForIds(product_ids); // libellé propre (fini "Subscription creation")

      const familyChange = !!targetFamily && targetFamily !== r.family;
      const nameChange = !!targetName && targetName !== r.product_name;
      // Produit inconnu (aucune cible) OU rien à changer → on passe.
      if (!familyChange && !nameChange) continue;

      stats.changed++;
      const fromLabel = `${r.family || "—"}${r.product_name ? ` / ${r.product_name}` : ""}`;
      const toLabel = `${targetFamily || r.family || "—"}${targetName ? ` / ${targetName}` : ""}`;
      stats.changes.push({ charge_id: r.charge_id, from: fromLabel, to: toLabel, email: r.email });
      const key = `${fromLabel} → ${toLabel}`;
      stats.by_transition[key] = (stats.by_transition[key] || 0) + 1;

      if (!dryRun) {
        const update: Record<string, unknown> = {};
        if (familyChange) update.family = targetFamily;
        if (nameChange) update.product_name = targetName;
        // Laforêt : on neutralise aussi l'attribution (hors objectifs/commissions).
        if (isLaforet) {
          update.auto_commercial_id = null;
          update.override_commercial_id = null;
          update.auto_score = 0;
          update.auto_source = "Abo Laforet (hors objectifs)";
          update.auto_reason = "Abonnement marque grise Laforêt — hors objectifs et hors commissions (reclassement).";
        }
        const { error } = await sb.from("attribution_rows").update(update).eq("charge_id", r.charge_id);
        if (error) stats.errors.push({ charge_id: r.charge_id, error: error.message });
      }
    } catch (e) {
      stats.errors.push({ charge_id: r.charge_id, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  return NextResponse.json({ ok: true, duration_ms: Date.now() - start, ...stats });
}
