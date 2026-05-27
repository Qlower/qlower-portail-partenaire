import { createServiceClient } from "@/lib/supabase-server";
import AttributionTable, {
  type RowData,
  type CommercialOption,
  type HistoryEntry,
  type NoteEntry,
} from "@/components/internal/AttributionTable";
import LockMonthButton from "@/components/internal/LockMonthButton";
import RescoreMonthButton from "@/components/internal/RescoreMonthButton";
import ManualChargeButton from "@/components/internal/ManualChargeButton";
import MonthSelector from "@/components/internal/MonthSelector";
import PersonalObjective from "@/components/internal/PersonalObjective";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { resolveYearMonthWithFallback } from "@/lib/available-months";
import { formatYearMonthFull } from "@/lib/year-month";
import { resolveSalesView } from "@/lib/sales-view";

// Données live : l'historique des modifications et les overrides doivent
// refléter l'état temps réel. Sans force-dynamic, Next.js 16 sert un rendu
// caché et les changements récents n'apparaissent pas.
export const dynamic = "force-dynamic";

interface DbRow {
  charge_id: string;
  email: string;
  client_name: string | null;
  created_at: string;
  amount_net_eur: number;
  commissionable_amount_eur: number | null;
  commissionable_adjusted_reason: string | null;
  commissionable_adjusted_by_email: string | null;
  commissionable_adjusted_at: string | null;
  family: string | null;
  newbiz_1m: string | null;
  newbiz_3m: string | null;
  auto_commercial_id: string | null;
  auto_score: number | null;
  auto_source: string | null;
  auto_reason: string | null;
  override_commercial_id: string | null;
  override_set_by: string | null;
  override_set_at: string | null;
  flagged_for_review: boolean | null;
  flagged_reason: string | null;
  flagged_by: string | null;
  flagged_at: string | null;
}

async function loadAttributionData(yearMonth: string) {
  const sb = createServiceClient();

  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked, locked_at, year_month")
    .eq("year_month", yearMonth)
    .maybeSingle();

  const { data: rawRows } = await sb
    .from("attribution_rows")
    .select(
      "charge_id, email, client_name, created_at, amount_net_eur, amount_gross_eur, amount_refunded_eur, refunded_after_lock, commissionable_amount_eur, commissionable_adjusted_reason, commissionable_adjusted_by_email, commissionable_adjusted_at, family, newbiz_1m, newbiz_3m, auto_commercial_id, auto_score, auto_source, auto_reason, override_commercial_id, override_set_by, override_set_at, flagged_for_review, flagged_reason, flagged_by, flagged_at",
    )
    .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");

  const dbRows = (rawRows || []) as DbRow[];

  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");

  // Fetch history + notes in single queries (avoid N+1)
  const chargeIds = dbRows.map((r) => r.charge_id);
  const { data: history } = chargeIds.length
    ? await sb
        .from("attribution_history")
        .select("id, charge_id, who_email, from_commercial, to_commercial, comment, when_at")
        .in("charge_id", chargeIds)
        .order("when_at", { ascending: false })
    : { data: [] as Array<HistoryEntry & { charge_id: string }> };

  const { data: notes } = chargeIds.length
    ? await sb
        .from("attribution_notes")
        .select("id, charge_id, author_email, text, when_at")
        .in("charge_id", chargeIds)
        .order("when_at", { ascending: false })
    : { data: [] as Array<NoteEntry & { charge_id: string }> };

  const historyByCharge = new Map<string, HistoryEntry[]>();
  for (const h of history || []) {
    const list = historyByCharge.get(h.charge_id) || [];
    list.push({
      id: h.id,
      when_at: h.when_at,
      who_email: h.who_email,
      from_commercial: h.from_commercial,
      to_commercial: h.to_commercial,
      comment: h.comment,
    });
    historyByCharge.set(h.charge_id, list);
  }
  const notesByCharge = new Map<string, NoteEntry[]>();
  for (const n of notes || []) {
    const list = notesByCharge.get(n.charge_id) || [];
    list.push({
      id: n.id,
      author_email: n.author_email,
      when_at: n.when_at,
      text: n.text,
    });
    notesByCharge.set(n.charge_id, list);
  }

  const commById = new Map((commercials || []).map((c) => [c.id, c]));

  // Index user_id → commercial pour résoudre les flaggers / overrideurs
  // (les colonnes flagged_by et override_set_by stockent l'auth user_id,
  // pas le commercial.id).
  const { data: commercialsWithUid } = await sb
    .from("commercials")
    .select("user_id, name, email");
  const commByUserId = new Map(
    (commercialsWithUid || [])
      .filter((c) => !!c.user_id)
      .map((c) => [c.user_id as string, { name: c.name as string, email: c.email as string | null }]),
  );

  const rows: RowData[] = dbRows.map((r) => {
    const effectiveId = r.override_commercial_id || r.auto_commercial_id;
    const effectiveCommercial = effectiveId ? commById.get(effectiveId) : null;
    const flagger = r.flagged_by ? commByUserId.get(r.flagged_by) : null;
    return {
      charge_id: r.charge_id,
      email: r.email,
      client_name: r.client_name,
      created_at: r.created_at,
      amount_net_eur: r.amount_net_eur,
      amount_gross_eur: (r as DbRow & { amount_gross_eur?: number }).amount_gross_eur,
      amount_refunded_eur: (r as DbRow & { amount_refunded_eur?: number }).amount_refunded_eur,
      refunded_after_lock: (r as DbRow & { refunded_after_lock?: boolean }).refunded_after_lock,
      commissionable_amount_eur: r.commissionable_amount_eur,
      commissionable_adjusted_reason: r.commissionable_adjusted_reason,
      commissionable_adjusted_by_email: r.commissionable_adjusted_by_email,
      commissionable_adjusted_at: r.commissionable_adjusted_at,
      family: r.family,
      newbiz_1m: r.newbiz_1m,
      newbiz_3m: r.newbiz_3m,
      auto_commercial_id: r.auto_commercial_id,
      auto_score: r.auto_score,
      auto_source: r.auto_source,
      auto_reason: r.auto_reason,
      override_commercial_id: r.override_commercial_id,
      override_set_by_email: null,
      override_set_at: r.override_set_at,
      effective_commercial_id: effectiveId,
      effective_commercial_name: effectiveCommercial?.name || null,
      is_override: !!r.override_commercial_id,
      flagged_for_review: !!r.flagged_for_review,
      flagged_reason: r.flagged_reason,
      flagged_by_user_id: r.flagged_by,
      flagged_by_name: flagger?.name || null,
      flagged_by_email: flagger?.email || null,
      flagged_at: r.flagged_at,
      history: historyByCharge.get(r.charge_id) || [],
      notes: notesByCharge.get(r.charge_id) || [],
    };
  });

  const commercialOptions: CommercialOption[] = (commercials || []).map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
  }));

  return { rows, commercials: commercialOptions, run };
}

async function getAuthedUserMeta() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  return {
    internalRole: (meta.internal_role as string | undefined) || null,
    myCommercialId: (meta.commercial_id as string | undefined) || null,
    myUserId: user?.id || null,
  };
}

export default async function AttributionAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const { yearMonth, available: availableMonths } = await resolveYearMonthWithFallback(params.ym);
  const { rows, commercials, run } = await loadAttributionData(yearMonth);
  const monthLabel = formatYearMonthFull(yearMonth);
  const editable = !run?.locked;
  const { internalRole, myCommercialId, myUserId } = await getAuthedUserMeta();
  const isSalesAdmin = internalRole === "sales_admin";
  const resolved = resolveSalesView({ viewParam: params.view, internalRole, myCommercialId });
  const tableView = resolved?.tableView;
  const speedometerView = resolved?.speedometerView;

  // Total CA du mois — utile pour visualiser l'atteinte d'objectif.
  // On utilise le montant commissionnable s'il est override (ex: upsell),
  // sinon le net Stripe. Aligné avec la paie effective.
  const totalCA = rows.reduce((s, r) => {
    const amt =
      r.commissionable_amount_eur !== null && r.commissionable_amount_eur !== undefined
        ? Number(r.commissionable_amount_eur)
        : Number(r.amount_net_eur);
    return s + (amt || 0);
  }, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3855]">Attribution — {monthLabel}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} ligne{rows.length > 1 ? "s" : ""} · <strong className="text-[#0A3855]">{Math.round(totalCA).toLocaleString("fr-FR")} €</strong> · Édition admin{" "}
            {run?.locked ? "(verrouillé)" : "(active)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <MonthSelector current={yearMonth} available={availableMonths} />
          <ManualChargeButton />
          <RescoreMonthButton yearMonth={yearMonth} isLocked={!!run?.locked} />
          <LockMonthButton yearMonth={yearMonth} isLocked={!!run?.locked} />
          <a
            href={`/sales`}
            className="text-xs text-gray-500 hover:text-[#0A3855] px-3 py-1.5 border border-gray-200 rounded"
          >
            ← Vue d&apos;ensemble
          </a>
        </div>
      </div>

      <PersonalObjective yearMonth={yearMonth} view={speedometerView || undefined} />

      {/* Alerte refund-after-lock : remboursements arrivés après verrouillage du mois */}
      {(() => {
        const refundedAfterLock = rows.filter((r) => r.refunded_after_lock);
        if (refundedAfterLock.length === 0) return null;
        const totalClawback = refundedAfterLock.reduce(
          (s, r) => s + (r.amount_refunded_eur || 0),
          0,
        );
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl shrink-0">⚠️</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-orange-900">
                  Remboursements post-clôture détectés : {refundedAfterLock.length} ligne{refundedAfterLock.length > 1 ? "s" : ""}
                </div>
                <div className="text-xs text-orange-800 mt-1 leading-relaxed">
                  Le mois est verrouillé mais des refunds sont arrivés depuis pour un total de{" "}
                  <strong>{Math.round(totalClawback).toLocaleString("fr-FR")} € remboursés</strong>.
                  Les commissions correspondantes ont probablement déjà été versées —
                  pense au <strong>clawback</strong> sur la paie suivante des négos concernés.
                  Filtre la liste avec le bouton <strong>"↩ Remboursées"</strong> pour voir le détail.
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <AttributionTable
        key={`${yearMonth}-${tableView || "team"}`}
        rows={rows}
        commercials={commercials}
        editable={editable}
        yearMonth={yearMonth}
        view={tableView || undefined}
        myUserId={myUserId}
        myCommercialId={myCommercialId}
        isSalesAdmin={isSalesAdmin}
      />
    </div>
  );
}
