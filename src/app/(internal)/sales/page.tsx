import { createServiceClient } from "@/lib/supabase-server";
import Link from "next/link";

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

const MONTHS_FR: Record<string, string> = {
  "01": "Janvier", "02": "Février", "03": "Mars", "04": "Avril",
  "05": "Mai", "06": "Juin", "07": "Juillet", "08": "Août",
  "09": "Septembre", "10": "Octobre", "11": "Novembre", "12": "Décembre",
};

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
    .select("amount_net_eur, auto_commercial_id, override_commercial_id, auto_score, flagged_for_review")
    .eq("run_id", runRow?.id || "00000000-0000-0000-0000-000000000000");

  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");

  // Aggregate by effective commercial.
  type Agg = { name: string; role: string; rows: number; net: number; flagged: number };
  const byId = new Map<string, Agg>();
  let totalNet = 0;
  let flaggedCount = 0;
  for (const r of rows || []) {
    const cid = (r.override_commercial_id || r.auto_commercial_id) as string | null;
    const c = commercials?.find((x) => x.id === cid);
    const key = cid || "unmapped";
    const cur = byId.get(key) || {
      name: c?.name || "(Non attribué)",
      role: c?.role || "none",
      rows: 0, net: 0, flagged: 0,
    };
    cur.rows++;
    cur.net += r.amount_net_eur;
    if (r.flagged_for_review) cur.flagged++;
    byId.set(key, cur);
    totalNet += r.amount_net_eur;
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
    perCommercial: [...byId.entries()]
      .map(([id, v]) => ({
        id,
        ...v,
        target: targetById.get(id) || 0,
      }))
      .sort((a, b) => b.net - a.net),
  };
}

export default async function SalesHomePage() {
  // Default to current month — will move to a month picker once multi-month exists.
  const yearMonth = "2026-04";
  const data = await getDashboardData(yearMonth);

  const monthLabel = `${MONTHS_FR[yearMonth.slice(-2)]} ${yearMonth.slice(0, 4)}`;
  const objectivePct = data.teamTarget > 0 ? (data.totalNet / data.teamTarget) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0A3855]">
          Tour de contrôle Sales — {monthLabel}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.totalRows} lignes en scope · {data.flaggedCount > 0 ? <span className="text-orange-600 font-medium">{data.flaggedCount} 🚩 contestation{data.flaggedCount > 1 ? "s" : ""}</span> : "Aucune contestation"}
          {data.locked && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-700">🔒 Mois clôturé</span>}
        </p>
      </div>

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
