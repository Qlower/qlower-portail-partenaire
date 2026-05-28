// Section "Mon objectif" — Jour / Semaine / Mois pour un négo donné.
//
// Server component utilisable sur n'importe quelle page sales pour afficher
// les counters de progression personnels du négo connecté. Réutilisée par
// /sales (Mon mois) et /sales/ventes (Mes ventes).

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServiceClient } from "@/lib/supabase-server";
import { currentYearMonth } from "@/lib/year-month";
import {
  workingDaysInMonth,
  workingDaysElapsedThisMonth,
  workingDaysInWeek,
  startOfWeekIso,
  isWorkingDay,
} from "@/lib/working-days";
import SpeedometerGauge from "./SpeedometerGauge";
import ObjectiveViewSelector from "./ObjectiveViewSelector";

interface CommercialAuth {
  commercial_id: string | null;
  name: string | null;
  internal_role: string | null;
}

async function getCurrentUserCommercial(): Promise<CommercialAuth | null> {
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
  if (!user) return null;
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  return {
    commercial_id: (meta.commercial_id as string | undefined) || null,
    name: (meta.name as string | undefined) || null,
    internal_role: (meta.internal_role as string | undefined) || null,
  };
}

interface PersonalStats {
  today: { obj: number; real: number; pct: number };
  week: { obj: number; real: number; pct: number };
  month: { obj: number; real: number; pct: number };
  pacing: { expected: number; real: number; deltaDays: number };
  // Retenue à appliquer sur la paie commission (cumul décommissionnements)
  retenue: number;
}

// Filtre des charges selon le mode :
//   - "team" : toutes les lignes (peu importe le commercial)
//   - commercial_id : uniquement les lignes attribuées à ce commercial
type ChargesFilter = { mode: "team" } | { mode: "commercial"; commercialId: string };

async function getPersonalStats(
  filter: ChargesFilter,
  yearMonth: string,
  monthlyObj: number,
): Promise<PersonalStats> {
  const sb = createServiceClient();
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekStartIso = startOfWeekIso(today);

  const { data: run } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (!run?.id) {
    return {
      today: { obj: 0, real: 0, pct: 0 },
      week: { obj: 0, real: 0, pct: 0 },
      month: { obj: monthlyObj, real: 0, pct: 0 },
      pacing: { expected: 0, real: 0, deltaDays: 0 },
      retenue: 0,
    };
  }

  const { data: rows } = await sb
    .from("attribution_rows")
    .select("amount_net_eur, commissionable_amount_eur, auto_commercial_id, override_commercial_id, created_at, decommission_commercial_id, decommission_amount_eur")
    .eq("run_id", run.id);

  const mine = (rows || []).filter((r) => {
    if (filter.mode === "team") return true;
    const cid = r.override_commercial_id || r.auto_commercial_id;
    return cid === filter.commercialId;
  });

  // On commissionne sur commissionable_amount_eur s'il est set (override
  // admin pour upsell ou ajustement), sinon sur amount_net_eur.
  const commish = (r: { amount_net_eur: number | null; commissionable_amount_eur: number | null }) =>
    (r.commissionable_amount_eur !== null && r.commissionable_amount_eur !== undefined
      ? Number(r.commissionable_amount_eur)
      : Number(r.amount_net_eur)) || 0;

  const monthReal = mine.reduce((s, r) => s + commish(r), 0);
  const todayReal = mine
    .filter((r) => (r.created_at || "").slice(0, 10) === todayIso)
    .reduce((s, r) => s + commish(r), 0);
  const weekReal = mine
    .filter((r) => (r.created_at || "").slice(0, 10) >= weekStartIso)
    .reduce((s, r) => s + commish(r), 0);

  const totalWorkingDays = workingDaysInMonth(yearMonth);
  const workingDaysInThisWeek = workingDaysInWeek(today);
  const elapsed = workingDaysElapsedThisMonth(today);
  const isToday = isWorkingDay(today);

  const dailyObj = totalWorkingDays > 0 ? monthlyObj / totalWorkingDays : 0;
  const weeklyObj = dailyObj * workingDaysInThisWeek;
  const expected = dailyObj * elapsed;
  const todayObj = isToday ? dailyObj : 0;

  // Retenue à appliquer sur la paie commission de ce négo (cumul des
  // décommissionnements sur lignes refund ledger qui ciblent ce négo).
  // En vue team, c'est le cumul de TOUTES les retenues du mois.
  const retenue = (rows || [])
    .filter((r) => {
      if (!r.decommission_commercial_id || !r.decommission_amount_eur) return false;
      if (filter.mode === "team") return true;
      return r.decommission_commercial_id === filter.commercialId;
    })
    .reduce((s, r) => s + Number(r.decommission_amount_eur || 0), 0);

  return {
    today: {
      obj: todayObj,
      real: todayReal,
      pct: todayObj > 0 ? (todayReal / todayObj) * 100 : 0,
    },
    week: {
      obj: weeklyObj,
      real: weekReal,
      pct: weeklyObj > 0 ? (weekReal / weeklyObj) * 100 : 0,
    },
    month: {
      obj: monthlyObj,
      real: monthReal,
      pct: monthlyObj > 0 ? (monthReal / monthlyObj) * 100 : 0,
    },
    pacing: {
      expected,
      real: monthReal,
      deltaDays: dailyObj > 0 ? (monthReal - expected) / dailyObj : 0,
    },
    retenue,
  };
}

/**
 * Composant async server qui affiche la section "Mon objectif".
 *
 * - sales_admin par défaut → vue "team" (objectif équipe entière)
 * - sales par défaut → vue "self" (son propre objectif)
 * - Tout user peut basculer via `?view=team` / `?view=<commercial_id>`
 *
 * Selon le mois sélectionné :
 *   - Mois courant : 3 cartes (Jour / Semaine / Mois) + pacing
 *   - Mois passé : 1 carte (Mois) + speedometer avec % final
 *   - Mois futur : null (pas de sens)
 *
 * Affiche null si :
 *   - L'utilisateur n'a pas de rôle interne
 *   - Le mois sélectionné est dans le futur
 *   - La vue sélectionnée n'a pas d'objectif défini
 */
export default async function PersonalObjective({
  yearMonth,
  view,
}: {
  yearMonth: string;
  view?: string;
}) {
  const user = await getCurrentUserCommercial();
  if (!user) return null;
  // Mois futur → pas de speedometer
  if (yearMonth > currentYearMonth()) return null;
  const isPastMonth = yearMonth < currentYearMonth();

  const isAdmin = user.internal_role === "sales_admin";

  // Résolution du mode de vue :
  //   - URL param `view` prioritaire (team / commercial_id)
  //   - sinon : sales_admin → team, sales → self (own commercial)
  let resolvedView: string;
  if (view === "team" && isAdmin) {
    resolvedView = "team";
  } else if (view && view !== "team") {
    resolvedView = view; // commercial_id
  } else if (isAdmin) {
    resolvedView = "team";
  } else if (user.commercial_id) {
    resolvedView = user.commercial_id;
  } else {
    return null;
  }

  const sb = createServiceClient();

  // Charge TOUS les commerciaux (incl. former et support) pour le dropdown
  const { data: allCommercials } = await sb
    .from("commercials")
    .select("id, name, role")
    .order("name");
  const commercialsList = allCommercials || [];

  // Compute counts pour le dropdown : lignes par commercial + cas spéciaux
  const { data: runForCount } = await sb
    .from("monthly_runs")
    .select("id")
    .eq("year_month", yearMonth)
    .maybeSingle();
  const counts = {
    team: 0,
    byCommercialId: {} as Record<string, number>,
    unassigned: 0,
    autonome: 0,
    support: 0,
    former: 0,
  };
  if (runForCount?.id) {
    const { data: allRows } = await sb
      .from("attribution_rows")
      .select("auto_commercial_id, override_commercial_id")
      .eq("run_id", runForCount.id);
    counts.team = allRows?.length || 0;
    for (const r of allRows || []) {
      const cid = r.override_commercial_id || r.auto_commercial_id;
      if (!cid) {
        counts.unassigned++;
        continue;
      }
      counts.byCommercialId[cid] = (counts.byCommercialId[cid] || 0) + 1;
      const c = commercialsList.find((x) => x.id === cid);
      if (c?.role === "system_none") counts.autonome++;
      if (c?.role === "support") counts.support++;
      if (c?.role === "former") counts.former++;
    }
  }

  // Détermine objectif + nom de la vue
  let monthlyObj = 0;
  let viewTitle = "";
  let filter: ChargesFilter;
  let isSpecialView = false; // unassigned / autonome / support / former → no speedometer

  if (resolvedView === "team") {
    const { data: teamTarget } = await sb
      .from("team_monthly_targets")
      .select("target_eur")
      .eq("year_month", yearMonth)
      .maybeSingle();
    monthlyObj = teamTarget?.target_eur || 0;
    viewTitle = "Équipe entière";
    filter = { mode: "team" };
  } else if (resolvedView === "unassigned") {
    monthlyObj = 0;
    viewTitle = "Non attribué";
    isSpecialView = true;
    filter = { mode: "team" }; // les stats elles-mêmes ne sont pas utilisées
  } else if (resolvedView === "autonome") {
    monthlyObj = 0;
    viewTitle = "Achats autonomes";
    isSpecialView = true;
    filter = { mode: "team" };
  } else if (resolvedView === "support") {
    monthlyObj = 0;
    viewTitle = "Support";
    isSpecialView = true;
    filter = { mode: "team" };
  } else if (resolvedView === "former") {
    monthlyObj = 0;
    viewTitle = "Anciens collaborateurs";
    isSpecialView = true;
    filter = { mode: "team" };
  } else {
    // commercial_id classique
    const c = commercialsList?.find((x) => x.id === resolvedView);
    if (!c) return null;
    const { data: targetRow } = await sb
      .from("commercial_monthly_targets")
      .select("target_eur")
      .eq("year_month", yearMonth)
      .eq("commercial_id", resolvedView)
      .maybeSingle();
    monthlyObj = targetRow?.target_eur || 0;
    viewTitle = c.id === user.commercial_id ? `${c.name} (moi)` : c.name;
    filter = { mode: "commercial", commercialId: resolvedView };
  }

  if (isSpecialView || monthlyObj <= 0) {
    // Vue spéciale (non attribué / autonome / support / anciens) OU pas d'objectif :
    // pas de speedometer. On affiche juste le récap + dropdown pour rebasculer.
    const specialCounts: Record<string, number> = {
      unassigned: counts.unassigned,
      autonome: counts.autonome,
      support: counts.support,
      former: counts.former,
    };
    const ventesCount = isSpecialView ? specialCounts[resolvedView] || 0 : 0;
    return (
      <div className="bg-gradient-to-br from-[#FFF5ED] to-white border border-[#F6CCA4]/50 rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#B8864E] font-semibold">
              Vue — {viewTitle}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isSpecialView
                ? `${ventesCount} vente${ventesCount > 1 ? "s" : ""} dans cette vue. Pas d'objectif individuel — hors classement.`
                : `Aucun objectif défini pour cette vue sur ${yearMonth}.`}
            </p>
          </div>
          {isAdmin && (
            <ObjectiveViewSelector
              current={resolvedView}
              commercials={commercialsList || []}
              allowTeam={true}
              myCommercialId={user.commercial_id}
              counts={counts}
            />
          )}
        </div>
      </div>
    );
  }

  const stats = await getPersonalStats(filter, yearMonth, monthlyObj);

  // Status texte pour le speedometer.
  // Mois passé : juste le verdict final ("Atteint" / "Manqué").
  // Mois courant : pacing en jours d'avance/retard.
  const monthPct = stats.month.pct;
  const ahead = stats.pacing.real >= stats.pacing.expected;
  const absDays = Math.abs(stats.pacing.deltaDays);
  let statusText: string;
  if (isPastMonth) {
    if (monthPct >= 100) statusText = "🏆 Objectif atteint";
    else if (monthPct >= 80) statusText = "📊 Proche de l'objectif";
    else statusText = "⚠️ Objectif manqué";
  } else if (monthPct >= 100) {
    statusText = "🏆 Objectif atteint !";
  } else if (ahead && absDays >= 1) {
    statusText = `🎯 +${absDays.toFixed(1)}j d'avance`;
  } else if (!ahead && absDays >= 1) {
    statusText = `⏰ ${absDays.toFixed(1)}j de retard`;
  } else {
    statusText = "À l'heure";
  }

  const realFmt = `${Math.round(stats.month.real).toLocaleString("fr-FR")} €`;
  const objFmt = `${Math.round(stats.month.obj).toLocaleString("fr-FR")} €`;

  return (
    <div className="bg-gradient-to-br from-[#FFF5ED] to-white border border-[#F6CCA4]/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#B8864E] font-semibold">
            Objectif — {viewTitle}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {isPastMonth
              ? `Bilan rétroactif du mois ${yearMonth} — comparé à l'objectif.`
              : "Décliné Jour / Semaine / Mois sur la base des jours ouvrés (Lun-Ven, hors fériés FR)."}
          </p>
          {stats.retenue > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-100 border border-amber-300 text-[11px] text-amber-800">
              <span>⚠</span>
              <span>
                Retenue paie ce mois :{" "}
                <strong>−{Math.round(stats.retenue).toLocaleString("fr-FR")} €</strong>{" "}
                <span className="text-amber-700/70">
                  (décommissionnements admin — n&apos;impacte pas le CA affiché)
                </span>
              </span>
            </div>
          )}
        </div>
        {isAdmin && (
          <ObjectiveViewSelector
            current={resolvedView}
            commercials={commercialsList || []}
            allowTeam={true}
            myCommercialId={user.commercial_id}
            counts={counts}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-center">
        {/* Speedometer mensuel */}
        <div className="flex justify-center lg:justify-start">
          <SpeedometerGauge
            pct={monthPct}
            label={`${monthPct.toFixed(0)} %`}
            sub={`${realFmt} / ${objFmt}`}
            status={statusText}
            size={320}
          />
        </div>

        {/* Cards : 3 (jour/sem/mois) pour le mois courant, 1 (mois) pour les mois passés */}
        <div className={`grid grid-cols-1 ${isPastMonth ? "" : "sm:grid-cols-3"} gap-3`}>
          {!isPastMonth && (
            <PersonalCard
              label="Aujourd'hui"
              obj={stats.today.obj}
              real={stats.today.real}
              pct={stats.today.pct}
              sub={stats.today.obj > 0 ? "" : "Pas un jour ouvré"}
            />
          )}
          {!isPastMonth && (
            <PersonalCard
              label="Cette semaine"
              obj={stats.week.obj}
              real={stats.week.real}
              pct={stats.week.pct}
            />
          )}
          <PersonalCard
            label={isPastMonth ? `Bilan ${yearMonth}` : "Ce mois"}
            obj={stats.month.obj}
            real={stats.month.real}
            pct={stats.month.pct}
            highlight
          />
        </div>
      </div>
    </div>
  );
}

function PersonalCard({
  label,
  obj,
  real,
  pct,
  sub,
  highlight,
}: {
  label: string;
  obj: number;
  real: number;
  pct: number;
  sub?: string;
  highlight?: boolean;
}) {
  const reached = pct >= 100;
  const colorBar = reached
    ? "bg-emerald-500"
    : pct >= 70
      ? "bg-[#0A3855]"
      : pct >= 30
        ? "bg-[#F6CCA4]"
        : "bg-orange-300";
  const showSub =
    sub ||
    (obj > 0
      ? reached
        ? `+${Math.round(real - obj).toLocaleString("fr-FR")} € de dépassement`
        : `Reste ${Math.round(Math.max(0, obj - real)).toLocaleString("fr-FR")} €`
      : "Pas d'objectif");
  return (
    <div
      className={`rounded-lg p-4 ${highlight ? "bg-white border-2 border-[#0A3855]" : "bg-white border border-gray-200"}`}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
        <div
          className={`text-xs font-semibold tabular-nums ${
            reached
              ? "text-emerald-600"
              : pct >= 70
                ? "text-[#0A3855]"
                : "text-orange-600"
          }`}
        >
          {obj > 0 ? `${pct.toFixed(0)}%` : "—"}
        </div>
      </div>
      <div className="mt-1.5 text-2xl font-bold text-[#0A3855] tabular-nums">
        {Math.round(real).toLocaleString("fr-FR")} €
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5">
        sur objectif <strong>{Math.round(obj).toLocaleString("fr-FR")} €</strong>
      </div>
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${colorBar} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <div className="text-[10px] text-gray-400 mt-1.5">{showSub}</div>
    </div>
  );
}

