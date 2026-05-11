import { createServiceClient } from "@/lib/supabase-server";
import { currentYearMonth, isValidYearMonth } from "@/lib/year-month";

/**
 * Fetch all months that have a monthly_runs row, with their lock status.
 * Used by the MonthSelector dropdown across all /sales/** pages.
 */
export async function loadAvailableMonths(): Promise<
  Array<{ year_month: string; locked: boolean }>
> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("monthly_runs")
    .select("year_month, locked")
    .order("year_month", { ascending: false });
  return (data || []).map((r) => ({
    year_month: r.year_month as string,
    locked: !!r.locked,
  }));
}

/**
 * Resolve which month to display by default.
 *
 * Order of priority :
 *   1) ?ym=YYYY-MM dans l'URL (explicite, on respecte)
 *   2) Mois courant SI il a un monthly_run en DB
 *   3) Sinon le mois le plus récent ayant des data
 *   4) Fallback : mois courant (cas du tout premier mois sans data)
 *
 * Évite que les pages affichent un mois vide par défaut quand on est
 * début de mois et qu'aucun paiement Stripe n'a encore eu lieu.
 */
export async function resolveYearMonthWithFallback(
  paramYm: string | string[] | undefined,
): Promise<{ yearMonth: string; available: Array<{ year_month: string; locked: boolean }> }> {
  const v = Array.isArray(paramYm) ? paramYm[0] : paramYm;
  const available = await loadAvailableMonths();

  // 1) Explicite via URL
  if (isValidYearMonth(v)) {
    return { yearMonth: v, available };
  }

  // 2) Mois courant s'il a des data
  const today = currentYearMonth();
  if (available.some((m) => m.year_month === today)) {
    return { yearMonth: today, available };
  }

  // 3) Dernier mois avec data
  if (available.length > 0) {
    return { yearMonth: available[0].year_month, available };
  }

  // 4) Fallback ultime
  return { yearMonth: today, available };
}
