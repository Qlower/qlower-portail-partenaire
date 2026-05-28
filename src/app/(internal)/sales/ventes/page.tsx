import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import AttributionTable, {
  type RowData,
  type CommercialOption,
  type HistoryEntry,
  type NoteEntry,
} from "@/components/internal/AttributionTable";
import MonthSelector from "@/components/internal/MonthSelector";
import PersonalObjective from "@/components/internal/PersonalObjective";
import { resolveYearMonthWithFallback } from "@/lib/available-months";
import { formatYearMonthFull } from "@/lib/year-month";
import { resolveSalesView } from "@/lib/sales-view";

// Données live : vues "mes ventes" + historique doivent refléter l'état temps
// réel. Sans force-dynamic, Next.js 16 sert un rendu caché.
export const dynamic = "force-dynamic";

async function getCurrentUser() {
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
  return user;
}

async function loadVentesData(yearMonth: string) {
  const sb = createServiceClient();
  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked, year_month")
    .eq("year_month", yearMonth)
    .maybeSingle();

  // Tour de contrôle : tout le monde charge TOUTES les ventes du mois.
  // Le filtrage "Mes ventes" se fait côté client via les filter chips
  // (l'utilisateur peut basculer entre Toutes / Mes / Contestées / etc.).
  const { data: rawRows } = await sb
    .from("attribution_rows")
    .select(
      "charge_id, email, client_name, created_at, amount_net_eur, amount_gross_eur, amount_refunded_eur, refunded_after_lock, commissionable_amount_eur, commissionable_adjusted_reason, commissionable_adjusted_by_email, commissionable_adjusted_at, family, newbiz_1m, newbiz_3m, auto_commercial_id, auto_score, auto_source, auto_reason, override_commercial_id, override_set_at, flagged_for_review, flagged_reason, flagged_by, flagged_at",
    )
    .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");
  const dbRows = rawRows || [];

  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");

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
    list.push({ id: h.id, when_at: h.when_at, who_email: h.who_email, from_commercial: h.from_commercial, to_commercial: h.to_commercial, comment: h.comment });
    historyByCharge.set(h.charge_id, list);
  }
  const notesByCharge = new Map<string, NoteEntry[]>();
  for (const n of notes || []) {
    const list = notesByCharge.get(n.charge_id) || [];
    list.push({ id: n.id, author_email: n.author_email, when_at: n.when_at, text: n.text });
    notesByCharge.set(n.charge_id, list);
  }

  const commById = new Map((commercials || []).map((c) => [c.id, c]));

  // Index user_id → commercial pour résoudre le flagger (auth.user_id, pas commercial.id)
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
    const flagBy = (r as { flagged_by?: string | null }).flagged_by || null;
    const flagger = flagBy ? commByUserId.get(flagBy) : null;
    return {
      charge_id: r.charge_id,
      email: r.email,
      client_name: r.client_name,
      created_at: r.created_at,
      amount_net_eur: r.amount_net_eur,
      amount_gross_eur: (r as { amount_gross_eur?: number }).amount_gross_eur,
      amount_refunded_eur: (r as { amount_refunded_eur?: number }).amount_refunded_eur,
      refunded_after_lock: (r as { refunded_after_lock?: boolean }).refunded_after_lock,
      commissionable_amount_eur: (r as { commissionable_amount_eur?: number | null }).commissionable_amount_eur ?? null,
      commissionable_adjusted_reason: (r as { commissionable_adjusted_reason?: string | null }).commissionable_adjusted_reason ?? null,
      commissionable_adjusted_by_email: (r as { commissionable_adjusted_by_email?: string | null }).commissionable_adjusted_by_email ?? null,
      commissionable_adjusted_at: (r as { commissionable_adjusted_at?: string | null }).commissionable_adjusted_at ?? null,
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
      flagged_by_user_id: flagBy,
      flagged_by_name: flagger?.name || null,
      flagged_by_email: flagger?.email || null,
      flagged_at: (r as { flagged_at?: string | null }).flagged_at ?? null,
      history: historyByCharge.get(r.charge_id) || [],
      notes: notesByCharge.get(r.charge_id) || [],
    };
  });

  const commercialOptions: CommercialOption[] = (commercials || []).map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
  }));

  return { rows, commercials: commercialOptions };
}

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const viewParam = params.view;
  const { yearMonth, available: availableMonths } = await resolveYearMonthWithFallback(params.ym);
  const user = await getCurrentUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const internalRole = meta.internal_role as "sales" | "sales_admin" | undefined;
  const myCommercialId = (meta.commercial_id as string | undefined) || null;
  const myName = (meta.name as string | undefined) || "Moi";
  // Vues résolues (2 dimensions distinctes : table vs speedometer)
  const resolved = resolveSalesView({ viewParam, internalRole, myCommercialId });
  const tableView = resolved?.tableView;
  const speedometerView = resolved?.speedometerView;

  const { rows, commercials } = await loadVentesData(yearMonth);

  const monthLabel = formatYearMonthFull(yearMonth);
  // Aligné sur PersonalObjective et /sales : on totalise sur le montant
  // commissionnable (override admin = upsell, refund assumé, etc.), pas sur
  // le brut Stripe — pour que tous les CA affichés soient cohérents.
  const total = rows.reduce((sum, r) => {
    const amt =
      r.commissionable_amount_eur !== null && r.commissionable_amount_eur !== undefined
        ? Number(r.commissionable_amount_eur)
        : Number(r.amount_net_eur);
    return sum + (amt || 0);
  }, 0);
  const myRowsCount = myCommercialId
    ? rows.filter((r) => r.effective_commercial_id === myCommercialId).length
    : 0;

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3855]">Tour de contrôle — {monthLabel}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} ligne{rows.length > 1 ? "s" : ""} équipe · {Math.round(total).toLocaleString("fr-FR")} €
            {myCommercialId && (
              <> · <span className="text-[#0A3855] font-medium">{myRowsCount} pour {myName}</span></>
            )}
          </p>
        </div>
        <MonthSelector current={yearMonth} available={availableMonths} />
      </div>

      {/* Speedometer : pour sales = leur perso, pour admin = ?view ou team */}
      <PersonalObjective yearMonth={yearMonth} view={speedometerView || undefined} />

      <AttributionTable
        key={`${yearMonth}-${tableView || "team"}`}
        rows={rows}
        commercials={commercials}
        mode="sales-team"
        myCommercialId={myCommercialId}
        myUserId={user?.id || null}
        isSalesAdmin={internalRole === "sales_admin"}
        defaultFilterMine={false}
        yearMonth={yearMonth}
        view={tableView || undefined}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700">
        💡 <strong>Tu peux contester une attribution qui te concerne</strong> en cliquant sur 🚩 — le manager sera notifié et arbitrera.{" "}
        <strong>Tu peux aussi ajouter une note sur n&apos;importe quelle vente</strong> (visible par toute l&apos;équipe et le manager).
      </div>
    </div>
  );
}
