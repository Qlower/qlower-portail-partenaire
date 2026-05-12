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
}

async function getPersonalStats(
  commercialId: string,
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
    };
  }

  const { data: rows } = await sb
    .from("attribution_rows")
    .select("amount_net_eur, auto_commercial_id, override_commercial_id, created_at")
    .eq("run_id", run.id);

  const mine = (rows || []).filter((r) => {
    const cid = r.override_commercial_id || r.auto_commercial_id;
    return cid === commercialId;
  });

  const monthReal = mine.reduce((s, r) => s + (r.amount_net_eur || 0), 0);
  const todayReal = mine
    .filter((r) => (r.created_at || "").slice(0, 10) === todayIso)
    .reduce((s, r) => s + (r.amount_net_eur || 0), 0);
  const weekReal = mine
    .filter((r) => (r.created_at || "").slice(0, 10) >= weekStartIso)
    .reduce((s, r) => s + (r.amount_net_eur || 0), 0);

  const totalWorkingDays = workingDaysInMonth(yearMonth);
  const workingDaysInThisWeek = workingDaysInWeek(today);
  const elapsed = workingDaysElapsedThisMonth(today);
  const isToday = isWorkingDay(today);

  const dailyObj = totalWorkingDays > 0 ? monthlyObj / totalWorkingDays : 0;
  const weeklyObj = dailyObj * workingDaysInThisWeek;
  const expected = dailyObj * elapsed;
  const todayObj = isToday ? dailyObj : 0;

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
  };
}

/**
 * Composant async server qui affiche la section "Mon objectif" Jour/Semaine/Mois.
 * Affiche null si :
 *   - L'utilisateur n'a pas de commercial_id
 *   - Le mois sélectionné n'est pas le mois courant
 *   - L'utilisateur n'a pas d'objectif mensuel défini
 */
export default async function PersonalObjective({ yearMonth }: { yearMonth: string }) {
  const user = await getCurrentUserCommercial();
  if (!user?.commercial_id) return null;
  if (yearMonth !== currentYearMonth()) return null;

  const sb = createServiceClient();
  const { data: targetRow } = await sb
    .from("commercial_monthly_targets")
    .select("target_eur")
    .eq("year_month", yearMonth)
    .eq("commercial_id", user.commercial_id)
    .maybeSingle();
  const monthlyObj = targetRow?.target_eur || 0;
  if (monthlyObj <= 0) return null;

  const stats = await getPersonalStats(user.commercial_id, yearMonth, monthlyObj);

  return (
    <div className="bg-gradient-to-br from-[#FFF5ED] to-white border border-[#F6CCA4]/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[#B8864E] font-semibold">
            Mon objectif — {user.name || "Moi"}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Décliné Jour / Semaine / Mois sur la base des jours ouvrés (Lun-Ven, hors fériés FR).
          </p>
        </div>
        <PacingBadge pacing={stats.pacing} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PersonalCard
          label="Aujourd'hui"
          obj={stats.today.obj}
          real={stats.today.real}
          pct={stats.today.pct}
          sub={stats.today.obj > 0 ? "" : "Pas un jour ouvré"}
        />
        <PersonalCard
          label="Cette semaine"
          obj={stats.week.obj}
          real={stats.week.real}
          pct={stats.week.pct}
        />
        <PersonalCard
          label="Ce mois"
          obj={stats.month.obj}
          real={stats.month.real}
          pct={stats.month.pct}
          highlight
        />
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

function PacingBadge({
  pacing,
}: {
  pacing: { expected: number; real: number; deltaDays: number };
}) {
  if (pacing.expected <= 0) return null;
  const delta = pacing.real - pacing.expected;
  const ahead = delta >= 0;
  const absDays = Math.abs(pacing.deltaDays);
  const formatDelta =
    absDays >= 1
      ? `${absDays.toFixed(1)}j ${ahead ? "d'avance" : "de retard"}`
      : "à l'heure";
  return (
    <div className="inline-flex flex-col items-end text-right">
      <span
        className={`text-[11px] uppercase tracking-wider font-semibold ${
          ahead ? "text-emerald-700" : "text-orange-700"
        }`}
      >
        {ahead ? "🎯 En avance" : "⏰ À rattraper"}
      </span>
      <span className="text-xs text-gray-600 mt-0.5 tabular-nums">
        {ahead ? "+" : ""}
        {Math.round(delta).toLocaleString("fr-FR")} € · {formatDelta}
      </span>
    </div>
  );
}
