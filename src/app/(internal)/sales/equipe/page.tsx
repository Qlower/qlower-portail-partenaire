import { createServiceClient } from "@/lib/supabase-server";
import { Trophy } from "lucide-react";
import MonthSelector from "@/components/internal/MonthSelector";
import { resolveYearMonthWithFallback } from "@/lib/available-months";
import { formatYearMonthFull } from "@/lib/year-month";

async function loadTeamData(yearMonth: string) {
  const sb = createServiceClient();

  const { data: run } = await sb
    .from("monthly_runs")
    .select("id, locked")
    .eq("year_month", yearMonth)
    .maybeSingle();

  const { data: rows } = await sb
    .from("attribution_rows")
    .select("amount_net_eur, commissionable_amount_eur, auto_commercial_id, override_commercial_id, flagged_for_review")
    .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");

  const { data: commercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");

  const { data: targets } = await sb
    .from("commercial_monthly_targets")
    .select("commercial_id, target_eur")
    .eq("year_month", yearMonth);
  const targetById = new Map<string, number>();
  for (const t of targets || []) targetById.set(t.commercial_id, t.target_eur);

  const { data: teamTarget } = await sb
    .from("team_monthly_targets")
    .select("target_eur")
    .eq("year_month", yearMonth)
    .maybeSingle();

  // Aggregate by effective commercial
  type Agg = {
    id: string;
    name: string;
    role: string;
    rows: number;
    net: number;
    flagged: number;
    target: number;
  };
  const byId = new Map<string, Agg>();
  let autonomeNet = 0;
  let autonomeRows = 0;
  // On commissionne sur commissionable_amount_eur si défini (override admin),
  // sinon amount_net_eur. Le classement reflète donc le vrai dû paie.
  const commish = (r: { amount_net_eur: number; commissionable_amount_eur: number | null }) =>
    r.commissionable_amount_eur !== null && r.commissionable_amount_eur !== undefined
      ? Number(r.commissionable_amount_eur)
      : Number(r.amount_net_eur);
  for (const r of rows || []) {
    const cid = (r.override_commercial_id || r.auto_commercial_id) as string | null;
    if (!cid) continue;
    const c = commercials?.find((x) => x.id === cid);
    if (!c) continue;
    const amount = commish(r);
    // Achats autonomes : compté dans le total mais pas dans le classement.
    if (c.role === "system_none") {
      autonomeNet += amount;
      autonomeRows++;
      continue;
    }
    const cur = byId.get(cid) || {
      id: cid,
      name: c.name,
      role: c.role,
      rows: 0,
      net: 0,
      flagged: 0,
      target: targetById.get(cid) || 0,
    };
    cur.rows++;
    cur.net += amount;
    if (r.flagged_for_review) cur.flagged++;
    byId.set(cid, cur);
  }

  // Include zero-CA commercials so the team list is complete
  for (const c of commercials || []) {
    if ((c.role === "sales" || c.role === "sales_admin") && !byId.has(c.id)) {
      byId.set(c.id, {
        id: c.id,
        name: c.name,
        role: c.role,
        rows: 0,
        net: 0,
        flagged: 0,
        target: targetById.get(c.id) || 0,
      });
    }
  }

  const all = [...byId.values()].sort((a, b) => b.net - a.net);
  return { all, teamTarget: teamTarget?.target_eur || 0, autonomeNet, autonomeRows };
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[] }>;
}) {
  const params = await searchParams;
  const { yearMonth, available: availableMonths } = await resolveYearMonthWithFallback(params.ym);
  const { all, teamTarget, autonomeNet, autonomeRows } = await loadTeamData(yearMonth);
  const monthLabel = formatYearMonthFull(yearMonth);

  // Le total d'équipe inclut les achats autonomes (pour la jauge globale)
  // mais le classement individuel ne les liste pas.
  const totalNet = all.reduce((s, c) => s + c.net, 0) + autonomeNet;
  const teamPct = teamTarget > 0 ? (totalNet / teamTarget) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0A3855]">Équipe — {monthLabel}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Classement temps réel · {fmtEur(totalNet)} sur {fmtEur(teamTarget)} d&apos;objectif équipe ({fmtPct(teamPct)})
          </p>
        </div>
        <MonthSelector current={yearMonth} available={availableMonths} />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Commercial</th>
              <th className="px-4 py-3 text-right">CA Net</th>
              <th className="px-4 py-3 text-right">Objectif</th>
              <th className="px-4 py-3 text-right">% atteint</th>
              <th className="px-4 py-3 text-right">Lignes</th>
              <th className="px-4 py-3">Progression</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c, i) => {
              const pct = c.target > 0 ? (c.net / c.target) * 100 : 0;
              const ahead = pct >= 100;
              const colorBar = ahead
                ? "bg-emerald-500"
                : pct >= 70
                  ? "bg-[#0A3855]"
                  : pct >= 30
                    ? "bg-amber-400"
                    : "bg-red-300";
              return (
                <tr key={c.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {i === 0 && c.target > 0 ? (
                      <Trophy className="w-4 h-4 text-amber-500" />
                    ) : (
                      <span className="text-xs text-gray-400">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <strong className="text-gray-900">{c.name}</strong>
                    <span className="ml-2 text-[11px] text-gray-400">({c.role})</span>
                    {c.flagged > 0 && (
                      <span className="ml-2 text-[11px] text-orange-600">🚩 {c.flagged}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtEur(c.net)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono tabular-nums">
                    {c.target > 0 ? fmtEur(c.target) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {c.target > 0 ? (
                      <span className={ahead ? "text-emerald-600" : pct >= 70 ? "text-[#0A3855]" : "text-orange-600"}>
                        {fmtPct(pct)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500 font-mono tabular-nums">{c.rows}</td>
                  <td className="px-4 py-3">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full max-w-[180px]">
                      <div className={`h-full ${colorBar} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {autonomeRows > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between text-xs">
          <span className="text-gray-600">
            🚫 <strong>Achats autonomes</strong> — {autonomeRows} vente{autonomeRows > 1 ? "s" : ""} sans intervention sales (hors classement)
          </span>
          <span className="font-mono tabular-nums text-gray-700">{fmtEur(autonomeNet)}</span>
        </div>
      )}

      <p className="text-[11px] text-gray-400 text-center">
        Vue accessible à toute l&apos;équipe (lecture seule pour les négos).
      </p>
    </div>
  );
}
