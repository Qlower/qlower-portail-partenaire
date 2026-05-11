// Vue rapport mensuelle pour partage d'écran (présentation big boss).
// KPIs gros, graph cumulatif jour par jour vs objectif, détail par négo
// avec commissions calculées automatiquement.
//
// /sales/rapport?ym=YYYY-MM (sélecteur de mois en haut)

import { Trophy, AlertTriangle, TrendingUp, Users, Package, Clock, Crown } from "lucide-react";
import MonthSelector from "@/components/internal/MonthSelector";
import { resolveYearMonthWithFallback } from "@/lib/available-months";
import { formatYearMonthFull } from "@/lib/year-month";
import {
  loadReportData,
  type DailyPoint,
  type NegoLine,
  type CompositionStat,
  type TopClient,
  type ReportData,
} from "@/lib/sales-report";
import { fmtEurCents } from "@/lib/commissions";
import { hubspotSearchByEmailUrl } from "@/lib/hubspot-urls";

const fmtEur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string | string[] }>;
}) {
  const params = await searchParams;
  const { yearMonth, available: availableMonths } = await resolveYearMonthWithFallback(params.ym);
  const data = await loadReportData(yearMonth);
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

      {/* Sommaire — clique pour scroller à la section */}
      <nav className="bg-white border border-gray-200 rounded-xl px-5 py-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600">
        <span className="font-semibold text-gray-400">Sections :</span>
        <a href="#kpis" className="hover:text-[#0A3855] hover:underline">1. KPIs</a>
        <a href="#composition" className="hover:text-[#0A3855] hover:underline">2. Composition du CA</a>
        <a href="#funnel" className="hover:text-[#0A3855] hover:underline">3. Funnel & délais</a>
        <a href="#negos" className="hover:text-[#0A3855] hover:underline">4. Performance négos</a>
        <a href="#top-clients" className="hover:text-[#0A3855] hover:underline">5. Top clients</a>
        <a href="#distribution" className="hover:text-[#0A3855] hover:underline">6. Panier</a>
      </nav>

      <div id="kpis"></div>

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
          value={fmtEurCents(data.totalCommissions)}
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

      {/* ====== Section Composition ====== */}
      <div id="composition" />
      <h2 className="text-lg font-semibold text-[#0A3855] flex items-center gap-2 pt-2">
        <Package className="w-5 h-5" /> Composition du CA
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CompositionCard title="NewBiz vs OldBiz" subtitle="Sur tous les paiements du mois" stats={data.newbizStats} totalCA={data.totalCA_TTC} palette={["bg-emerald-500", "bg-gray-400", "bg-amber-400"]} />
        <CompositionCard title="Sales-touched vs Self-service" subtitle="Effort commercial avant le paiement" stats={data.sourceStats} totalCA={data.totalCA_TTC} palette={["bg-[#0A3855]", "bg-amber-400", "bg-gray-300"]} helpHover="Sales-touched = score ≥ 5 (Modjo, RDV, Aircall, SMS). Mid = owner identifié sans effort récent. Self-service = aucun effort traçable." />
        <CompositionCard title="Mix produits (family)" subtitle="Par catégorie de prestation" stats={data.productStats} totalCA={data.totalCA_TTC} palette={["bg-[#0A3855]", "bg-[#F6CCA4]", "bg-emerald-500", "bg-violet-400", "bg-sky-400", "bg-orange-400", "bg-pink-400"]} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Clients uniques" value={data.totalClients.toLocaleString("fr-FR")} sub={`${data.totalRows} ligne${data.totalRows > 1 ? "s" : ""} Stripe`} />
        <KpiCard label="Panier moyen / charge" value={fmtEur(data.panierMoyen_charge)} sub="TTC par ligne Stripe" />
        <KpiCard label="Panier moyen / client" value={fmtEur(data.panierMoyen_client)} sub="TTC tous achats cumulés" highlight="primary" />
      </div>

      {/* ====== Section Funnel & délais ====== */}
      <div id="funnel" />
      <h2 className="text-lg font-semibold text-[#0A3855] flex items-center gap-2 pt-2">
        <Clock className="w-5 h-5" /> Funnel & délais de conversion
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Délai Lead → 1er paiement"
          value={data.funnel.avg_lead_to_payment_days != null ? `${Math.round(data.funnel.avg_lead_to_payment_days)} j` : "—"}
          sub={data.funnel.matched_lead_count > 0 ? `Calculé sur ${data.funnel.matched_lead_count} client(s) UTM matchés` : "Aucun lead UTM matché"}
        />
        <KpiCard
          label="Délai 1ère interaction → paiement"
          value={data.funnel.avg_first_touch_to_payment_days != null ? `${Math.round(data.funnel.avg_first_touch_to_payment_days)} j` : "—"}
          sub="Moyenne sales-touched"
        />
        <KpiCard
          label="Interactions avant closing"
          value={data.funnel.avg_interactions_before_close != null ? data.funnel.avg_interactions_before_close.toFixed(1) : "—"}
          sub="Effort commercial moyen (Modjo + RDV + Aircall)"
        />
        <KpiCard
          label="% Self-service"
          value={data.totalRows > 0 ? `${Math.round((data.funnel.self_service_clients / data.totalRows) * 100)}%` : "—"}
          sub={`${data.funnel.self_service_clients} ligne${data.funnel.self_service_clients > 1 ? "s" : ""} sans effort traçable`}
          highlight="amber"
        />
      </div>

      {/* Per-négo table */}
      <div id="negos" />
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
                {fmtEurCents(data.totalCommissions)}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {teamObjReached ? "Bonus 10% activé pour Hasan/Driss" : "Bonus équipe non activé"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ====== Section Top clients ====== */}
      <div id="top-clients" />
      <h2 className="text-lg font-semibold text-[#0A3855] flex items-center gap-2 pt-2">
        <Crown className="w-5 h-5" /> Top 10 clients du mois
      </h2>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Client</th>
              <th className="px-4 py-3 text-left">Family</th>
              <th className="px-4 py-3 text-right">Charges</th>
              <th className="px-4 py-3 text-right">CA TTC</th>
              <th className="px-4 py-3 text-right">% CA total</th>
            </tr>
          </thead>
          <tbody>
            {data.topClients.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-sm">Aucun client.</td></tr>
            ) : (
              data.topClients.map((c, i) => (
                <tr key={c.email} className="border-t border-gray-100 hover:bg-gray-50/40">
                  <td className="px-4 py-3 text-sm">
                    {i === 0 ? <Trophy className="w-4 h-4 text-amber-500" /> : <span className="text-gray-400">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={hubspotSearchByEmailUrl(c.email)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-gray-900 hover:text-[#0A3855] hover:underline block"
                      title="Ouvrir dans HubSpot"
                    >
                      {c.client_name || c.email}
                    </a>
                    {c.client_name && (
                      <a
                        href={hubspotSearchByEmailUrl(c.email)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono text-gray-400 hover:text-[#0A3855] hover:underline"
                        title="Ouvrir dans HubSpot"
                      >
                        {c.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.family || "—"}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums">{c.nb_charges}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[#0A3855] font-semibold">{fmtEur(c.ca)}</td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums">
                    {data.totalCA_TTC > 0 ? `${((c.ca / data.totalCA_TTC) * 100).toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
          <strong>Concentration :</strong> le top 10% des clients ({Math.max(1, Math.ceil(data.totalClients * 0.1))} clients sur {data.totalClients})
          fait <strong className="text-[#0A3855]">{data.concentrationTop10Pct.toFixed(1)}%</strong> du CA du mois.
        </div>
      </div>

      {/* ====== Section Distribution panier ====== */}
      <div id="distribution" />
      <h2 className="text-lg font-semibold text-[#0A3855] flex items-center gap-2 pt-2">
        <Users className="w-5 h-5" /> Comportement d&apos;achat
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.basketDistribution.map((b) => {
          const pctClients = data.totalClients > 0 ? (b.nb_clients / data.totalClients) * 100 : 0;
          const pctCA = data.totalCA_TTC > 0 ? (b.ca / data.totalCA_TTC) * 100 : 0;
          return (
            <div key={b.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{b.label}</div>
              <div className="text-3xl font-bold mt-1 text-[#0A3855]">
                {b.nb_clients}
                <span className="text-base font-normal text-gray-400 ml-2">client{b.nb_clients > 1 ? "s" : ""}</span>
              </div>
              <div className="text-xs text-gray-500 mt-2 space-y-0.5">
                <div>{pctClients.toFixed(1)}% des clients</div>
                <div className="font-mono text-gray-700">{fmtEur(b.ca)} <span className="text-gray-400">({pctCA.toFixed(1)}% CA)</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Légende des règles de commission */}
      <details className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 text-xs text-gray-700">
        <summary className="cursor-pointer font-semibold text-[#0A3855]">Barème commissions appliqué</summary>
        <div className="mt-3 space-y-2">
          <div><strong>Hasan, Driss</strong> : 3% du CA HT si obj perso non atteint · 5% si obj perso atteint · 10% si obj équipe atteint (priorité absolue)</div>
          <div><strong>Alex</strong> : 5% de son CA HT toujours · + 10% sur le DÉPASSEMENT de l&apos;objectif ÉQUIPE (ex : équipe 125k€ / obj 110k€ → bonus = 10% × 15k€ HT)</div>
          <div><strong>Jennyfer (upsell)</strong> : 2% du CA HT toujours</div>
          <div><strong>Rudo, Coline, anciens</strong> : pas de commission au barème actuel</div>
          <div className="text-gray-500 mt-2">CA HT = CA TTC ÷ 1.20 (TVA 20%). Centimes affichés pour le calcul de paie. Si tu réattribues une vente manuellement, la commission suit la nouvelle attribution.</div>
        </div>
      </details>
    </div>
  );
}

function CompositionCard({
  title,
  subtitle,
  stats,
  totalCA,
  palette,
  helpHover,
}: {
  title: string;
  subtitle: string;
  stats: CompositionStat[];
  totalCA: number;
  palette: string[];
  helpHover?: string;
}) {
  // Stacked bar
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-semibold text-[#0A3855]">{title}</h3>
        {helpHover && <span className="text-[10px] text-gray-400" title={helpHover}>ⓘ</span>}
      </div>
      <p className="text-[11px] text-gray-500 mb-3">{subtitle}</p>

      {/* Stacked progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex mb-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`h-full ${palette[i % palette.length]}`}
            style={{ width: `${s.pct_ca}%` }}
            title={`${s.label} : ${s.pct_ca.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Liste détaillée */}
      <ul className="space-y-1.5 text-xs">
        {stats.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className={`w-2 h-2 rounded-full ${palette[i % palette.length]} shrink-0`} />
              <span className="text-gray-700 truncate">{s.label}</span>
            </span>
            <span className="text-gray-600 tabular-nums whitespace-nowrap">
              {Math.round(s.ca).toLocaleString("fr-FR")} € · <span className="text-gray-400">{s.pct_ca.toFixed(1)}%</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-100">
        Total : {Math.round(totalCA).toLocaleString("fr-FR")} € TTC
      </div>
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
        <div className="font-bold text-[#0A3855] font-mono tabular-nums">{fmtEurCents(commission.amount_eur)}</div>
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
