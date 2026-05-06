import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import AttributionTable, {
  type RowData,
  type CommercialOption,
  type HistoryEntry,
  type NoteEntry,
} from "@/components/internal/AttributionTable";

const MONTHS_FR: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
};

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

async function loadVentesData(yearMonth: string, filterByCommercialId: string | null) {
  const sb = createServiceClient();
  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked, year_month")
    .eq("year_month", yearMonth)
    .maybeSingle();

  let q = sb
    .from("attribution_rows")
    .select(
      "charge_id, email, created_at, amount_net_eur, family, newbiz_1m, newbiz_3m, auto_commercial_id, auto_score, auto_source, auto_reason, override_commercial_id, override_set_at, flagged_for_review, flagged_reason",
    )
    .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");

  if (filterByCommercialId) {
    // Sales view: only rows where auto OR override = my commercial_id
    q = q.or(
      `auto_commercial_id.eq.${filterByCommercialId},override_commercial_id.eq.${filterByCommercialId}`,
    );
  }

  const { data: rawRows } = await q;
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

export default async function VentesPage() {
  const yearMonth = "2026-04";
  const user = await getCurrentUser();
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const internalRole = meta.internal_role as "sales" | "sales_admin" | undefined;
  const myCommercialId = (meta.commercial_id as string | undefined) || null;
  const myName = (meta.name as string | undefined) || "Moi";

  // Sales: filter to my own rows. Sales_admin: see everything.
  const filterCid = internalRole === "sales" ? myCommercialId : null;

  const { rows, commercials } = await loadVentesData(yearMonth, filterCid);

  const monthLabel = `${MONTHS_FR[yearMonth.slice(-2)]} ${yearMonth.slice(0, 4)}`;
  const total = rows.reduce((sum, r) => sum + r.amount_net_eur, 0);

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">
          {filterCid ? `Mes ventes — ${monthLabel}` : `Toutes les ventes — ${monthLabel}`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {filterCid
            ? `${rows.length} ligne${rows.length > 1 ? "s" : ""} attribuée${rows.length > 1 ? "s" : ""} à ${myName} · ${Math.round(total).toLocaleString("fr-FR")} €`
            : `${rows.length} ligne${rows.length > 1 ? "s" : ""} équipe · ${Math.round(total).toLocaleString("fr-FR")} €`}
        </p>
      </div>

      <AttributionTable
        rows={rows}
        commercials={commercials}
        mode={filterCid ? "sales-own" : "readonly"}
        showFlagButton={!!filterCid}
        yearMonth={yearMonth}
      />

      {filterCid && rows.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-gray-700">
          💡 <strong>Tu peux contester une attribution</strong> en cliquant sur 🚩 — le manager sera notifié et arbitrera.
          Tu peux aussi <strong>ajouter une note</strong> sur n&apos;importe laquelle de tes ventes pour donner un contexte.
        </div>
      )}
    </div>
  );
}
