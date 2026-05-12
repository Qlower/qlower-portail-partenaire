// Calcul du nombre de jours ouvrés (Lun-Ven) dans un mois donné.
// Optionnel : exclusion des jours fériés français.
//
// Utilisé pour calculer les objectifs quotidiens/hebdo des négos :
//   daily_target = monthly_target / working_days_in_month

/**
 * Jours fériés français récurrents (date fixe). Pâques/Pentecôte calculés
 * dynamiquement.
 */
const FIXED_HOLIDAYS = [
  { month: 1, day: 1 },   // Jour de l'An
  { month: 5, day: 1 },   // Fête du Travail
  { month: 5, day: 8 },   // Victoire 1945
  { month: 7, day: 14 },  // Fête nationale
  { month: 8, day: 15 },  // Assomption
  { month: 11, day: 1 },  // Toussaint
  { month: 11, day: 11 }, // Armistice 1918
  { month: 12, day: 25 }, // Noël
];

/** Algorithme de Gauss pour calculer le dimanche de Pâques d'une année. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function frenchHolidays(year: number): Set<string> {
  const set = new Set<string>();
  for (const h of FIXED_HOLIDAYS) {
    set.add(`${year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`);
  }
  const easter = easterSunday(year);
  // Lundi de Pâques = easter + 1
  const easterMonday = new Date(easter.getTime() + 24 * 3600 * 1000);
  set.add(easterMonday.toISOString().slice(0, 10));
  // Jeudi de l'Ascension = easter + 39
  const ascension = new Date(easter.getTime() + 39 * 24 * 3600 * 1000);
  set.add(ascension.toISOString().slice(0, 10));
  // Lundi de Pentecôte = easter + 50
  const pentecost = new Date(easter.getTime() + 50 * 24 * 3600 * 1000);
  set.add(pentecost.toISOString().slice(0, 10));
  return set;
}

/** Nombre total de jours ouvrés (Lun-Ven, hors fériés) dans un mois donné. */
export function workingDaysInMonth(yearMonth: string): number {
  const [yStr, mStr] = yearMonth.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  const holidays = frenchHolidays(year);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dow = date.getUTCDay(); // 0=dim, 6=sam
    if (dow === 0 || dow === 6) continue;
    const iso = date.toISOString().slice(0, 10);
    if (holidays.has(iso)) continue;
    count++;
  }
  return count;
}

/** Nombre de jours ouvrés écoulés depuis le 1er du mois jusqu'à `today` inclus. */
export function workingDaysElapsedThisMonth(today: Date = new Date()): number {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;
  const holidays = frenchHolidays(year);
  const day = today.getUTCDate();
  let count = 0;
  for (let d = 1; d <= day; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const iso = date.toISOString().slice(0, 10);
    if (holidays.has(iso)) continue;
    count++;
  }
  return count;
}

/** "YYYY-MM-DD" du lundi de la semaine ISO du jour donné (UTC). */
export function startOfWeekIso(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay() || 7; // dim=7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - day + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" du dimanche de la même semaine. */
export function endOfWeekIso(date: Date = new Date()): string {
  const monday = startOfWeekIso(date);
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours ouvrés sur la semaine en cours (Lun→Ven hors fériés). */
export function workingDaysInWeek(date: Date = new Date()): number {
  const startIso = startOfWeekIso(date);
  const start = new Date(`${startIso}T00:00:00Z`);
  let count = 0;
  for (let i = 0; i < 5; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const year = d.getUTCFullYear();
    const holidays = frenchHolidays(year);
    const iso = d.toISOString().slice(0, 10);
    if (!holidays.has(iso)) count++;
  }
  return count;
}

/** Aujourd'hui est-il un jour ouvré ? */
export function isWorkingDay(date: Date = new Date()): boolean {
  const dow = date.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const holidays = frenchHolidays(date.getUTCFullYear());
  return !holidays.has(date.toISOString().slice(0, 10));
}
