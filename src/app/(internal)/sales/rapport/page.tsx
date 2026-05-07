// Vue rapport mensuelle pour partage d'écran (présentation big boss).
// KPIs gros, graph cumulatif jour par jour vs objectif, détail par négo
// avec commissions calculées automatiquement.
//
// /sales/rapport?ym=YYYY-MM (sélecteur de mois en haut)

import { Trophy, AlertTriangle } from "lucide-react";
import MonthSelector from "@/components/internal/MonthSelector";
import { loadAvailableMonths } from "@/lib/available-months";
import { formatYearMonthFull, resolveYearMonth } from "@/lib/year-month";
import { loadReportData, type DailyPoint, type NegoLine } from "@/lib/sales-report";

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[] }>;
}) {
  const params = await searchParams;
  const yearMonth = resolveYearMonth(params.ym);
  const [data, availableMonths] = await Promise.all([
    loadReportData(yearMonth),
    loadAvailableMonths(),
  ]);
  const monthLabel = formatYearMonthFull(yearMonth);
  const teamPct = data.teamObj_eur > 0 ? (data.totalCA_TTC / data.teamObj_eur) * 100 : 0;
  const teamObjReached = teamPct >= 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1">
            Rapport mensuel — Partage d&apos;écran ready
          </div>
          <h1 className="text-3xl font-bold text-[#0A3855]">{monthLabel}</h1>
        </div>
        <MonthSelector current={yearMonth} available={availableMonths} />
      </div>

      {/* Hero KPIs (BIG) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="CA équipe TTC"
          value={fmtEur(data.totalCA_TTC)}
          sub={`HT ${fmtEur(data.totalCA_HT)}`}
        />
        <KpiCard
          label="Objectif équipe"
          value={fmtEur(data.teamObj_eur)}
          sub={teamObjReached ? "✅ Atteint" : `Reste ${fmtEur(Math.max(0, data.teamObj_eur - data.totalCA_TTC))}`}
        />
        <KpiCard
          label="Atteinte"
          value={fmtPct(teamPct)}
          sub={`${data.totalRows} ventes`}
          highlight={teamObjReached ? "green" : teamPct >= 70 ? "primary" : "amber"}
        />
        <KpiCard
          label="Commissions à verser"
          value={fmtEur(data.totalCommissions)}
          sub={`${data.negos.filter((n) => n.commission.amount_eur > 0).length} négos rémunérés`}
          highlight="primary"
        />
      </div>

      {/* Status banner */}
      {(data.flaggedCount > 0 || data.locked) && (
        <div className="flex flex-wrap gap-2">
          {data.flaggedCount > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-800 text-sm rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              {data.flaggedCount} contestation{data.flaggedCount > 1 ? "s" : ""} ouverte{data.flaggedCount > 1 ? "s" : ""}
            </span>
          )}
          {data.locked && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-300 text-gray-700 text-sm rounded-lg">
              🔒 Mois clôturé
            </span>
          )}
          {data.autonomeNet > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-lg">
              🚫 {fmtEur(data.autonomeNet)} d&apos;achats autonomes (hors classement)
            </span>
          )}
        </div>
      )}

      {/* Graph cumul */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#0A3855] mb-4">CA cumulé jour par jour</h2>
        <CumulChart daily={data.daily} target={data.teamObj_eur} />
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 bg-[#0A3855]" /> CA cumulé TTC
          </span>
          {data.teamObj_eur > 0 && (
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-0.5 border-t border-dashed border-amber-500" /> Objectif équipe
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0A3855]" /> Vente
          </span>
        </div>
      </div>

      {/* Per-négo table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0A3855]">Performance & commissions par négo</h2>
          <span className="text-xs text-gray-500">
            HT calculé sur base TVA 20% (TTC ÷ 1.20)
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Négo</th>
              <th className="px-4 py-3 text-right">CA TTC</th>
              <th className="px-4 py-3 text-right">CA HT</th>
              <th className="px-4 py-3 text-right">Objectif</th>
              <th className="px-4 py-3 text-right">% atteint</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3">Règle</th>
            </tr>
          </thead>
          <tbody>
            {data.negos.map((n, i) => (
              <NegoRow key={n.commercial_id} nego={n} rank={i + 1} />
            ))}
            {data.negos.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                Pas de données pour {monthLabel}.
              </td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr className="font-semibold text-sm">
              <td colSpan={2} className="px-4 py-3 text-[#0A3855]">Total équipe</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtEur(data.totalCA_TTC)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtEur(data.totalCA_HT)}</td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtEur(data.teamObj_eur)}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                <span className={teamObjReached ? "text-emerald-600" : teamPct >= 70 ? "text-[#0A3855]" : "text-orange-600"}>
                  {fmtPct(teamPct)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0A3855]">
                {fmtEur(data.totalCommissions)}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {teamObjReached ? "Bonus 10% activé pour Hasan/Driss" : "Bonus équipe non activé"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Légende des règles de commission */}
      <details className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-xs text-gray-700">
        <summary className="cursor-pointer font-semibold text-[#0A3855]">Barème commissions appliqué</summary>
        <div className="mt-3 space-y-2">
          <div><strong>Hasan, Driss</strong> : 3% du CA HT si obj perso non atteint · 5% si obj perso atteint · 10% si obj équipe atteint (priorité absolue)</div>
          <div><strong>Alex</strong> : 5% du CA HT toujours, + 10% sur le surplus au-delà de l&apos;obj perso si atteint</div>
          <div><strong>Rudo, Jennyfer, Coline</strong> : pas de commission au barème actuel</div>
          <div className="text-gray-500 mt-2">CA HT = CA TTC ÷ 1.20 (TVA 20%). Si tu réattribues une vente manuellement, la commission suit la nouvelle attribution.</div>
        </div>
      </details>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "primary" | "green" | "amber";
}) {
  const valueColor =
    highlight === "green"
      ? "text-emerald-600"
      : highlight === "amber"
        ? "text-orange-600"
        : "text-[#0A3855]";
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function NegoRow({ nego, rank }: { nego: NegoLine; rank: number }) {
  const { commission } = nego;
  const objReached = commission.obj_reached;
  const teamObjReached = commission.team_obj_reached;
  const colorBar =
    teamObjReached ? "bg-purple-500" : objReached ? "bg-emerald-500" : nego.obj_pct >= 70 ? "bg-[#0A3855]" : nego.obj_pct >= 30 ? "bg-amber-400" : "bg-red-300";

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-3 text-sm">
        {rank === 1 && nego.obj_eur > 0 ? <Trophy className="w-4 h-4 text-amber-500" /> : <span className="text-gray-400">{rank}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-gray-900">{nego.name}</div>
        <div className="text-[11px] text-gray-400">{nego.role} · {nego.rows} vente{nego.rows > 1 ? "s" : ""}{nego.flagged > 0 ? ` · 🚩 ${nego.flagged}` : ""}</div>
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{fmtEur(nego.ca_ttc)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">{fmtEur(nego.ca_ht)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">
        {nego.obj_eur > 0 ? fmtEur(nego.obj_eur) : "—"}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {nego.obj_eur > 0 ? (
          <div className="space-y-1">
            <div className={`font-semibold ${objReached ? "text-emerald-600" : nego.obj_pct >= 70 ? "text-[#0A3855]" : "text-orange-600"}`}>
              {fmtPct(nego.obj_pct)}
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-24 ml-auto">
              <div className={`h-full ${colorBar}`} style={{ width: `${Math.min(100, nego.obj_pct)}%` }} />
            </div>
          </div>
        ) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="font-bold text-[#0A3855] font-mono tabular-nums">{fmtEur(commission.amount_eur)}</div>
        <div className="text-[10px] text-gray-400 mt-0.5">{commission.rate_label}</div>
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500 max-w-xs">{commission.breakdown || "—"}</td>
    </tr>
  );
}

// ----------------------------------------------------------------------------
// Graph SVG inline — minimal, sans dépendance externe.
// X = jours du mois (1..N), Y = € cumulés. Ligne CA + ligne objectif.
// ----------------------------------------------------------------------------
function CumulChart({ daily, target }: { daily: DailyPoint[]; target: number }) {
  if (daily.length === 0) return null;
  const W = 800;
  const H = 220;
  const PAD = { l: 60, r: 20, t: 20, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const maxY = Math.max(target, ...daily.map((d) => d.cumul_ttc), 1);
  const stepX = innerW / Math.max(1, daily.length - 1);
  const yScale = (v: number) => PAD.t + innerH - (v / maxY) * innerH;

  const cumulPath = daily
    .map((d, i) => `${i === 0 ? "M" : "L"} ${PAD.l + i * stepX} ${yScale(d.cumul_ttc)}`)
    .join(" ");

  const todayDate = new Date().toISOString().slice(0, 10);
  const todayIdx = daily.findIndex((d) => d.date >= todayDate);

  // Y-axis ticks (5 lines)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxY * p));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet" className="text-gray-500">
      {/* Grid */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yScale(t)}
            y2={yScale(t)}
            stroke="#E5E7EB"
            strokeWidth="0.5"
          />
          <text x={PAD.l - 6} y={yScale(t) + 3} fontSize="9" textAnchor="end" fill="currentColor">
            {t.toLocaleString("fr-FR")} €
          </text>
        </g>
      ))}
      {/* Target line */}
      {target > 0 && (
        <g>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yScale(target)}
            y2={yScale(target)}
            stroke="#F59E0B"
            strokeWidth="1.2"
            strokeDasharray="4 3"
          />
          <text x={W - PAD.r - 4} y={yScale(target) - 4} fontSize="10" textAnchor="end" fill="#B45309" fontWeight="600">
            Obj {target.toLocaleString("fr-FR")} €
          </text>
        </g>
      )}
      {/* Today vertical line */}
      {todayIdx >= 0 && todayIdx < daily.length && (
        <g>
          <line
            x1={PAD.l + todayIdx * stepX}
            x2={PAD.l + todayIdx * stepX}
            y1={PAD.t}
            y2={PAD.t + innerH}
            stroke="#94A3B8"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
          <text
            x={PAD.l + todayIdx * stepX}
            y={PAD.t - 4}
            fontSize="9"
            textAnchor="middle"
            fill="#475569"
          >
            aujourd&apos;hui
          </text>
        </g>
      )}
      {/* Cumul line */}
      <path d={cumulPath} fill="none" stroke="#0A3855" strokeWidth="2.2" />
      {/* Daily dots only on days with sales */}
      {daily.map((d, i) =>
        d.daily_ttc > 0 ? (
          <circle
            key={d.date}
            cx={PAD.l + i * stepX}
            cy={yScale(d.cumul_ttc)}
            r="3"
            fill="#0A3855"
          />
        ) : null,
      )}
      {/* X-axis labels — first, ~middle, last */}
      {[0, Math.floor(daily.length / 2), daily.length - 1].filter((i) => i >= 0).map((i) => (
        <text
          key={i}
          x={PAD.l + i * stepX}
          y={H - 12}
          fontSize="9"
          textAnchor="middle"
          fill="currentColor"
        >
          {daily[i]?.date.slice(8) || ""}
        </text>
      ))}
    </svg>
  );
}
