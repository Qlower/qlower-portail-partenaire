import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";
import MonthSelector from "@/components/internal/MonthSelector";
import PersonalObjective from "@/components/internal/PersonalObjective";
import { resolveYearMonthWithFallback } from "@/lib/available-months";
import { formatYearMonthFull } from "@/lib/year-month";
import { resolveSalesView } from "@/lib/sales-view";

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// Server component — runs on each request, fetches from Supabase using
// the SERVICE role to avoid RLS surprise during V2 ramp-up. Will switch
// to the user-scoped anon client (RLS-aware) once we're confident the
// policies are tight.
async function getDashboardData(yearMonth: string) {
  const sb = createServiceClient();

  // Team monthly target.
  const { data: targetRow } = await sb
    .from("team_monthly_targets")
    .select("target_eur")
    .eq("year_month", yearMonth)
    .maybeSingle();

  // Monthly run.
  const { data: runRow } = await sb
    .from("monthly_runs")
    .select("id, total_net_eur, total_rows, locked")
    .eq("year_month", yearMonth)
    .maybeSingle();

  // Per-commercial totals (joins commercials for name).
  const { data: rows } = await sb
    .from("attribution_rows")
    .select("amount_net_eur, commissionable_amount_eur, auto_commercial_id, override_commercial_id, auto_score, flagged_for_review")
    .eq("run_id", runRow?.id || "00000000-0000-0000-0000-000000000000");

  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");

  // Aggregate by effective commercial.
  // Aligné avec PersonalObjective : on commissionne sur commissionable_amount_eur
  // s'il est set (override admin : upsell, refund assumé, etc.), sinon sur
  // amount_net_eur (brut Stripe). C'est le "CA réellement commissionable" qui
  // sert au calcul d'atteinte d'objectif et de commission.
  const commish = (r: { amount_net_eur: number | null; commissionable_amount_eur: number | null }) =>
    (r.commissionable_amount_eur !== null && r.commissionable_amount_eur !== undefined
      ? Number(r.commissionable_amount_eur)
      : Number(r.amount_net_eur)) || 0;

  type Agg = { name: string; role: string; rows: number; net: number; flagged: number };
  const byId = new Map<string, Agg>();
  let totalNet = 0;
  let flaggedCount = 0;
  // Hors-classement (achat autonome) : compté dans le total mais pas dans
  // le ranking individuel (puisqu'aucun commercial n'est responsable).
  let autonomeNet = 0;
  let autonomeRows = 0;
  for (const r of rows || []) {
    const amt = commish(r);
    const cid = (r.override_commercial_id || r.auto_commercial_id) as string | null;
    const c = commercials?.find((x) => x.id === cid);
    if (c?.role === "system_none") {
      autonomeNet += amt;
      autonomeRows++;
      totalNet += amt;
      if (r.flagged_for_review) flaggedCount++;
      continue;
    }
    const key = cid || "unmapped";
    const cur = byId.get(key) || {
      name: c?.name || "(Non attribué)",
      role: c?.role || "none",
      rows: 0, net: 0, flagged: 0,
    };
    cur.rows++;
    cur.net += amt;
    if (r.flagged_for_review) cur.flagged++;
    byId.set(key, cur);
    totalNet += amt;
    if (r.flagged_for_review) flaggedCount++;
  }

  // Per-commercial monthly targets.
  const { data: targets } = await sb
    .from("commercial_monthly_targets")
    .select("commercial_id, target_eur")
    .eq("year_month", yearMonth);
  const targetById = new Map<string, number>();
  for (const t of targets || []) targetById.set(t.commercial_id, t.target_eur);

  return {
    yearMonth,
    teamTarget: targetRow?.target_eur || 0,
    totalNet,
    totalRows: rows?.length || 0,
    locked: runRow?.locked || false,
    flaggedCount,
    autonomeNet,
    autonomeRows,
    perCommercial: [...byId.entries()]
      .map(([id, v]) => ({
        id,
        ...v,
        target: targetById.get(id) || 0,
      }))
      .sort((a, b) => b.net - a.net),
  };
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
  };
}

export default async function SalesHomePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[]; view?: string | string[] }>;
}) {
  const params = await searchParams;
  const { yearMonth, available: availableMonths } = await resolveYearMonthWithFallback(params.ym);
  const { internalRole, myCommercialId } = await getAuthedUserMeta();
  const resolved = resolveSalesView({ viewParam: params.view, internalRole, myCommercialId });
  const speedometerView = resolved?.speedometerView;
  const data = await getDashboardData(yearMonth);

  const monthLabel = formatYearMonthFull(yearMonth);
  const objectivePct = data.teamTarget > 0 ? (data.totalNet / data.teamTarget) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3855]">
            Tour de contrôle Sales — {monthLabel}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.totalRows} lignes en scope · {data.flaggedCount > 0 ? <span className="text-orange-600 font-medium">{data.flaggedCount} 🚩 contestation{data.flaggedCount > 1 ? "s" : ""}</span> : "Aucune contestation"}
            {data.locked && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">🔒 Mois clôturé</span>}
          </p>
        </div>
        <MonthSelector current={yearMonth} available={availableMonths} />
      </div>

      {/* Objectif — Jour / Semaine / Mois (uniquement si mois courant) */}
      <PersonalObjective yearMonth={yearMonth} view={speedometerView || undefined} />

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wider text-gray-500">CA équipe</div>
          <div className="text-3xl font-bold text-[#0A3855] mt-1">{fmtEur(data.totalNet)}</div>
          <div className="text-xs text-gray-500 mt-1">objectif {fmtEur(data.teamTarget)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wider text-gray-500">Atteinte objectif</div>
          <div className="text-3xl font-bold text-[#0A3855] mt-1">{fmtPct(objectivePct)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.teamTarget > 0
              ? `Reste ${fmtEur(Math.max(0, data.teamTarget - data.totalNet))}`
              : "Pas d'objectif défini"}
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0A3855] to-[#1a5577] transition-all"
              style={{ width: `${Math.min(100, objectivePct)}%` }}
            />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="text-xs uppercase tracking-wider text-gray-500">Lignes attribuées</div>
          <div className="text-3xl font-bold text-[#0A3855] mt-1">{data.totalRows}</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.flaggedCount > 0 ? `${data.flaggedCount} contestée${data.flaggedCount > 1 ? "s" : ""} à arbitrer` : "Tout en règle"}
          </div>
        </div>
      </div>

      {/* Hors-classement : achats autonomes */}
      {data.autonomeRows > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500">🚫 Hors classement — Achats autonomes</div>
            <div className="text-xs text-gray-600 mt-1">
              {data.autonomeRows} vente{data.autonomeRows > 1 ? "s" : ""} sans intervention sales
              (compté dans le CA équipe, pas dans le ranking individuel).
            </div>
          </div>
          <div className="text-xl font-bold text-gray-700 font-mono tabular-nums">
            {fmtEur(data.autonomeNet)}
          </div>
        </div>
      )}

      {/* Per-commercial */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#0A3855]">Performance par commercial</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Objectif individuel = part annuelle (Hasan/Driss 1/3 chacun, Alex/Rudo 1/6 chacun) × cible mensuelle équipe.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-5 py-3">Commercial</th>
              <th className="px-3 py-3 text-right">CA Net</th>
              <th className="px-3 py-3 text-right">Objectif</th>
              <th className="px-3 py-3 text-right">% atteint</th>
              <th className="px-3 py-3 text-right">Lignes</th>
              <th className="px-3 py-3">Progression</th>
            </tr>
          </thead>
          <tbody>
            {data.perCommercial.map((c) => {
              const pct = c.target > 0 ? (c.net / c.target) * 100 : 0;
              const ahead = pct >= 100;
              const colorBar = ahead
                ? "bg-emerald-500"
                : pct >= 70
                  ? "bg-[#0A3855]"
                  : "bg-orange-400";
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    <span className="ml-2 text-xs text-gray-400">({c.role})</span>
                    {c.flagged > 0 && (
                      <span className="ml-2 text-xs text-orange-600">🚩 {c.flagged}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{fmtEur(c.net)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-500">
                    {c.target > 0 ? fmtEur(c.target) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {c.target > 0 ? fmtPct(pct) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-gray-500">{c.rows}</td>
                  <td className="px-3 py-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full max-w-[200px]">
                      <div className={`h-full ${colorBar} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick links to other pages — placeholder until V2.C/D are built */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-[#0A3855] mb-2">📌 V2 en cours de construction</h3>
        <p className="text-xs text-gray-700 mb-3">
          Pages à venir : <Link href="/sales/ventes" className="underline">Mes ventes (détail + édition)</Link> ·{" "}
          <Link href="/sales/equipe" className="underline">Équipe</Link> ·{" "}
          <Link href="/sales/historique" className="underline">Historique</Link>
        </p>
        <p className="text-[11px] text-gray-500">
          Données Supabase live — ingest du {yearMonth} effectué le 05/05/2026.
        </p>
      </div>
    </div>
  );
}

