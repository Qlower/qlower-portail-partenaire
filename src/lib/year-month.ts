// Utilities pour manipuler les "year_month" du portail (format YYYY-MM).

const MONTHS_FR_FULL: Record<string, string> = {
  "01": "Janvier",
  "02": "Février",
  "03": "Mars",
  "04": "Avril",
  "05": "Mai",
  "06": "Juin",
  "07": "Juillet",
  "08": "Août",
  "09": "Septembre",
  "10": "Octobre",
  "11": "Novembre",
  "12": "Décembre",
};

const MONTHS_FR_SHORT: Record<string, string> = {
  "01": "Jan",
  "02": "Fév",
  "03": "Mar",
  "04": "Avr",
  "05": "Mai",
  "06": "Juin",
  "07": "Juil",
  "08": "Août",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Déc",
};

export function currentYearMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isValidYearMonth(s: string | undefined | null): s is string {
  if (!s) return false;
  return /^\d{4}-\d{2}$/.test(s);
}

export function resolveYearMonth(
  param: string | string[] | undefined,
  fallback?: string,
): string {
  const v = Array.isArray(param) ? param[0] : param;
  if (isValidYearMonth(v)) return v;
  return fallback ?? currentYearMonth();
}

export function formatYearMonthFull(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_FR_FULL[m] || m} ${y}`;
}

export function formatYearMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_FR_SHORT[m] || m} ${y.slice(2)}`;
}

/**
 * Returns the year-month strings for the previous/next month relative to ym.
 * E.g. shiftYearMonth("2026-01", -1) → "2025-12"
 */
export function shiftYearMonth(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const totalMonths = y * 12 + (m - 1) + delta;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}
