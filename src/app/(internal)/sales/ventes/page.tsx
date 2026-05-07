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
import { loadAvailableMonths } from "@/lib/available-months";
import { formatYearMonthFull, resolveYearMonth } from "@/lib/year-month";

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
      "charge_id, email, created_at, amount_net_eur, family, newbiz_1m, newbiz_3m, auto_commercial_id, auto_score, auto_source, auto_reason, override_commercial_id, override_set_at, flagged_for_review, flagged_reason",
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
  const rows: RowData[] = dbRows.map((r) => {
    const effectiveId = r.override_commercial_id || r.auto_commercial_id;
    const effectiveCommercial = effectiveId ? commById.get(effectiveId) : null;
    return {
      charge_id: r.charge_id,
      email: r.email,
      created_at: r.created_at,
      amount_net_eur: r.amount_net_eur,
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
  searchParams: Promise<{ ym?: string | string[] }>;
}) {
  const params = await searchParams;
  const yearMonth = resolveYearMonth(params.ym);
  const user = await getCurrentUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const internalRole = meta.internal_role as "sales" | "sales_admin" | undefined;
  const myCommercialId = (meta.commercial_id as string | undefined) || null;
  const myName = (meta.name as string | undefined) || "Moi";

  const [{ rows, commercials }, availableMonths] = await Promise.all([
    loadVentesData(yearMonth),
    loadAvailableMonths(),
  ]);

  const monthLabel = formatYearMonthFull(yearMonth);
  const total = rows.reduce((sum, r) => sum + r.amount_net_eur, 0);
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

      <AttributionTable
        rows={rows}
        commercials={commercials}
        mode="sales-team"
        myCommercialId={myCommercialId}
        defaultFilterMine={internalRole === "sales"}
        yearMonth={yearMonth}
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700">
        💡 <strong>Tu peux contester une attribution qui te concerne</strong> en cliquant sur 🚩 — le manager sera notifié et arbitrera.{" "}
        <strong>Tu peux aussi ajouter une note sur n&apos;importe quelle vente</strong> (visible par toute l&apos;équipe et le manager).
      </div>
    </div>
  );
}
