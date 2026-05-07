import { createServiceClient } from "@/lib/supabase-server";

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
