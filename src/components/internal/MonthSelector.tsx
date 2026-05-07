"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { formatYearMonthFull, shiftYearMonth, currentYearMonth } from "@/lib/year-month";

interface AvailableMonth {
  year_month: string;
  locked: boolean;
}

interface Props {
  /** The currently selected year-month (e.g. "2026-04") */
  current: string;
  /** All months that exist in monthly_runs (newest first). Includes the current month. */
  available: AvailableMonth[];
}

/**
 * Sélecteur de mois pour les pages /sales/**.
 *
 * Modifie le query param ?ym=YYYY-MM. Toutes les pages serveur lisent ce
 * param pour charger les données du mois sélectionné.
 *
 * UI : prev | dropdown | next | (badge "🔒" si verrouillé) | "Mois courant"
 * (raccourci si on a navigué loin).
 */
export default function MonthSelector({ current, available }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = currentYearMonth();
  const isLocked = available.find((m) => m.year_month === current)?.locked || false;

  function navigate(ym: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ym", ym);
    router.push(`${pathname}?${params.toString()}`);
  }

  const prev = shiftYearMonth(current, -1);
  const next = shiftYearMonth(current, 1);
  // List for dropdown : tous les mois en DB + le mois courant si pas encore en DB.
  const options = [...available];
  if (!options.find((m) => m.year_month === today)) {
    options.unshift({ year_month: today, locked: false });
  }
  if (!options.find((m) => m.year_month === current)) {
    options.push({ year_month: current, locked: false });
  }
  // Sort desc
  options.sort((a, b) => (a.year_month < b.year_month ? 1 : -1));

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(prev)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-[#0A3855] hover:border-gray-300"
        title={`Mois précédent (${formatYearMonthFull(prev)})`}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <select
        value={current}
        onChange={(e) => navigate(e.target.value)}
        className="text-sm font-semibold text-[#0A3855] bg-white border border-gray-200 rounded-md px-3 py-1.5 hover:border-gray-300 cursor-pointer"
      >
        {options.map((m) => (
          <option key={m.year_month} value={m.year_month}>
            {formatYearMonthFull(m.year_month)}
            {m.locked ? " 🔒" : ""}
          </option>
        ))}
      </select>

      <button
        onClick={() => navigate(next)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-[#0A3855] hover:border-gray-300"
        title={`Mois suivant (${formatYearMonthFull(next)})`}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {isLocked && (
        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />
          Mois verrouillé
        </span>
      )}

      {current !== today && (
        <button
          onClick={() => navigate(today)}
          className="text-[11px] text-gray-500 hover:text-[#0A3855] underline ml-1"
        >
          → Mois courant
        </button>
      )}
    </div>
  );
}
