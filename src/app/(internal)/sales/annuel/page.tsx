// Bilan annuel — cumul de l'année vs objectif annuel (somme des objectifs
// mensuels), + détail mois par mois. Complète les vues mensuelles.
//
// /sales/annuel?year=YYYY

import Link from "next/link";
import { CalendarRange, TrendingUp, Target, Gauge } from "lucide-react";
import { loadAnnualData, type AnnualMonth } from "@/lib/sales-report";
import { loadAvailableMonths } from "@/lib/available-months";

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default async function AnnuelPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>;
}) {
  const params = await searchParams;
  const available = await loadAvailableMonths();
  // On ne propose que les années réellement exploitées (>= 2026). 2024/2025
  // n'ont pas de stats fiables → on les masque du sélecteur.
  const MIN_YEAR = 2026;
  const yearsWithData = [...new Set(available.map((m) => m.year_month.slice(0, 4)))]
    .filter((y) => Number(y) >= MIN_YEAR)
    .sort()
    .reverse();
  const nowYear = new Date().getUTCFullYear();
  const yearParam = Array.isArray(params.year) ? params.year[0] : params.year;
  const year = Number(yearParam) || Number(yearsWithData[0]) || nowYear;

  const data = await loadAnnualData(year);

  // Rythme à date : CA cumulé vs objectif cumulé jusqu'au mois courant.
  const paceDeltaPct = data.expectedToDate > 0 ? ((data.caToDate - data.expectedToDate) / data.expectedToDate) * 100 : 0;
  const onTrack = data.caToDate >= data.expectedToDate;
  const attainmentReached = data.attainmentPct >= 100;
  const maxBar = Math.max(1, ...data.months.map((m) => Math.max(m.ca_ttc, m.objectif)));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header + sélecteur d'année */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4" /> Bilan annuel
          </div>
          <h1 className="text-3xl font-bold text-[#0A3855]">{year}</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {yearsWithData.map((y) => (
            <Link
              key={y}
              href={`/sales/annuel?year=${y}`}
              className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                String(year) === y
                  ? "bg-[#0A3855] text-white border-[#0A3855]"
                  : "bg-white text-[#0A3855] border-[#0A3855]/20 hover:bg-[#E5EDF1]/50"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

      {/* KPIs annuels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi icon={<Target className="w-4 h-4" />} label="Objectif annuel" value={fmtEur(data.objAnnual)} sub={`${data.elapsedMonths} mois écoulés`} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="CA équipe cumulé" value={fmtEur(data.caTotal)} sub={`HT ${fmtEur(data.caHT)}`} />
        <Kpi
          icon={<Gauge className="w-4 h-4" />}
          label="Atteinte annuelle"
          value={fmtPct(data.attainmentPct)}
          sub={attainmentReached ? "✅ Objectif annuel atteint" : `Reste ${fmtEur(Math.max(0, data.objAnnual - data.caTotal))}`}
          highlight={attainmentReached ? "green" : data.attainmentPct >= 70 ? "primary" : "amber"}
        />
        <Kpi
          icon={<Gauge className="w-4 h-4" />}
          label="Rythme à date"
          value={onTrack ? `+${fmtPct(Math.abs(paceDeltaPct))}` : `−${fmtPct(Math.abs(paceDeltaPct))}`}
          sub={`Cumul ${fmtEur(data.caToDate)} / attendu ${fmtEur(data.expectedToDate)}`}
          highlight={onTrack ? "green" : "amber"}
        />
      </div>

      {/* Barre de progression annuelle */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-[#0A3855]">Progression vers l&apos;objectif annuel</span>
          <span className="text-gray-500 tabular-nums">{fmtEur(data.caTotal)} / {fmtEur(data.objAnnual)} ({fmtPct(data.attainmentPct)})</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${attainmentReached ? "bg-emerald-500" : "bg-gradient-to-r from-[#0A3855] to-[#1a5577]"}`}
            style={{ width: `${Math.min(100, data.attainmentPct)}%` }}
          />
        </div>
        {(data.renewalsTotal > 0 || data.laforetTotal > 0) && (
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            {data.renewalsTotal > 0 && <span>+ {fmtEur(data.renewalsTotal)} de reconductions <span className="text-gray-400">(hors commission)</span></span>}
            {data.laforetTotal > 0 && <span>+ {fmtEur(data.laforetTotal)} d&apos;Abo Laforêt <span className="text-gray-400">(hors objectif)</span></span>}
          </div>
        )}
      </div>

      {/* Détail mois par mois */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#0A3855]">Détail mois par mois</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Mois</th>
              <th className="px-4 py-3 text-right">CA équipe</th>
              <th className="px-4 py-3 text-right">Objectif</th>
              <th className="px-4 py-3 text-right">% atteint</th>
              <th className="px-4 py-3 w-[30%]">Progression</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <MonthRow key={m.year_month} m={m} maxBar={maxBar} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-[#0A3855]">
              <td className="px-4 py-3">Total {year}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtEur(data.caTotal)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtEur(data.objAnnual)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtPct(data.attainmentPct)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-gray-400 text-center">
        Objectif annuel = somme des objectifs mensuels de l&apos;équipe. CA hors Abo Laforêt et hors reconductions
        (affichés à part). Pour le détail commissions, voir le Rapport mensuel.
      </p>
    </div>
  );
}

function MonthRow({ m, maxBar }: { m: AnnualMonth; maxBar: number }) {
  const pct = m.objectif > 0 ? (m.ca_ttc / m.objectif) * 100 : 0;
  const reached = pct >= 100;
  const barColor = reached ? "bg-emerald-500" : pct >= 70 ? "bg-[#0A3855]" : pct >= 30 ? "bg-amber-400" : "bg-red-300";
  const noData = !m.hasRun && m.objectif === 0;
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/40">
      <td className="px-4 py-3">
        <Link href={`/sales/rapport?ym=${m.year_month}`} className="font-medium text-gray-800 hover:text-[#0A3855] hover:underline">
          {MONTHS_FR[m.monthIndex - 1]} {m.year_month.slice(0, 4)}
        </Link>
        {m.locked && <span className="ml-2 text-[10px] text-gray-400">🔒</span>}
      </td>
      <td className="px-4 py-3 text-right font-mono tabular-nums">{noData ? "—" : fmtEur(m.ca_ttc)}</td>
      <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-500">{m.objectif > 0 ? fmtEur(m.objectif) : "—"}</td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums">
        {m.objectif > 0 ? (
          <span className={reached ? "text-emerald-600" : pct >= 70 ? "text-[#0A3855]" : "text-orange-600"}>{fmtPct(pct)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden max-w-[280px]">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, Math.max(0, (m.ca_ttc / maxBar) * 100))}%` }} />
        </div>
      </td>
    </tr>
  );
}

function Kpi({
  icon, label, value, sub, highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "amber" | "primary";
}) {
  const ring =
    highlight === "green"
      ? "border-emerald-200 bg-emerald-50/50"
      : highlight === "amber"
        ? "border-amber-200 bg-amber-50/50"
        : highlight === "primary"
          ? "border-[#0A3855]/20 bg-[#E5EDF1]/40"
          : "border-gray-200 bg-white";
  return (
    <div className={`rounded-xl border p-5 ${ring}`}>
      <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-3xl font-bold text-[#0A3855] mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
