// Aggrégations pour la page /sales/rapport.
// Charge un mois donné + calcule :
//   - KPIs équipe (CA, objectif, atteinte, lignes, contestations)
//   - Cumulatif jour par jour (pour le graph SVG)
//   - Détail par négo (CA, objectif, commission, atteinte)

import { createServiceClient } from "@/lib/supabase-server";
import { computeCommission, type CommissionResult } from "@/lib/commissions";

export interface NegoLine {
  commercial_id: string;
  name: string;
  role: string;
  ca_ttc: number;
  ca_ht: number;
  rows: number;
  flagged: number;
  obj_eur: number;
  obj_pct: number;
  commission: CommissionResult;
}

export interface DailyPoint {
  date: string;       // "YYYY-MM-DD"
  daily_ttc: number;  // CA TTC ce jour
  cumul_ttc: number;  // CA TTC cumulé depuis le 1er du mois
  cumul_ht: number;   // équivalent HT
}

export interface ReportData {
  yearMonth: string;
  teamObj_eur: number;
  totalCA_TTC: number;
  totalCA_HT: number;
  totalRows: number;
  flaggedCount: number;
  autonomeNet: number;
  locked: boolean;
  negos: NegoLine[];
  daily: DailyPoint[];
  totalCommissions: number;
}

export async function loadReportData(yearMonth: string): Promise<ReportData> {
  const sb = createServiceClient();

  const [{ data: run }, { data: targetRow }, { data: commercials }, { data: targets }] =
    await Promise.all([
      sb.from("monthly_runs").select("id, locked, total_net_eur").eq("year_month", yearMonth).maybeSingle(),
      sb.from("team_monthly_targets").select("target_eur").eq("year_month", yearMonth).maybeSingle(),
      sb.from("commercials").select("id, name, role, hubspot_owner_id"),
      sb.from("commercial_monthly_targets").select("commercial_id, target_eur").eq("year_month", yearMonth),
    ]);

  const teamObj = targetRow?.target_eur || 0;
  const targetById = new Map<string, number>();
  for (const t of targets || []) targetById.set(t.commercial_id, t.target_eur);

  const { data: rows } = await sb
    .from("attribution_rows")
    .select("amount_net_eur, auto_commercial_id, override_commercial_id, flagged_for_review, created_at")
    .eq("run_id", run?.id || "00000000-0000-0000-0000-000000000000");

  // Total team
  let totalCA_TTC = 0;
  let flaggedCount = 0;
  let autonomeNet = 0;
  for (const r of rows || []) {
    totalCA_TTC += r.amount_net_eur || 0;
    if (r.flagged_for_review) flaggedCount++;
    const cid = r.override_commercial_id || r.auto_commercial_id;
    const c = commercials?.find((x) => x.id === cid);
    if (c?.role === "system_none") autonomeNet += r.amount_net_eur || 0;
  }

  // Per-négo aggregation
  type Agg = {
    id: string;
    name: string;
    role: string;
    ca_ttc: number;
    rows: number;
    flagged: number;
  };
  const byId = new Map<string, Agg>();
  for (const r of rows || []) {
    const cid = (r.override_commercial_id || r.auto_commercial_id) as string | null;
    if (!cid) continue;
    const c = commercials?.find((x) => x.id === cid);
    if (!c) continue;
    const cur = byId.get(cid) || { id: cid, name: c.name, role: c.role, ca_ttc: 0, rows: 0, flagged: 0 };
    cur.ca_ttc += r.amount_net_eur || 0;
    cur.rows++;
    if (r.flagged_for_review) cur.flagged++;
    byId.set(cid, cur);
  }
  // Inclure les négos avec 0 CA mais qui ont un objectif
  for (const c of commercials || []) {
    if ((c.role === "sales" || c.role === "sales_admin") && !byId.has(c.id)) {
      byId.set(c.id, { id: c.id, name: c.name, role: c.role, ca_ttc: 0, rows: 0, flagged: 0 });
    }
  }

  const negos: NegoLine[] = [...byId.values()]
    .filter((a) => a.role !== "system_none" && a.role !== "former")
    .map((a) => {
      const obj = targetById.get(a.id) || 0;
      const commission = computeCommission({
        commercialId: a.id,
        commercialName: a.name,
        commercialRole: a.role,
        myCA_TTC: a.ca_ttc,
        myObj: obj,
        teamCA_TTC: totalCA_TTC,
        teamObj,
      });
      return {
        commercial_id: a.id,
        name: a.name,
        role: a.role,
        ca_ttc: a.ca_ttc,
        ca_ht: commission.ca_ht,
        rows: a.rows,
        flagged: a.flagged,
        obj_eur: obj,
        obj_pct: obj > 0 ? (a.ca_ttc / obj) * 100 : 0,
        commission,
      };
    })
    .sort((x, y) => y.ca_ttc - x.ca_ttc);

  // Daily cumul — répartition jour par jour, dans le mois sélectionné
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dailyMap = new Map<string, number>();
  for (let d = 1; d <= lastDayOfMonth; d++) {
    const day = `${yearMonth}-${String(d).padStart(2, "0")}`;
    dailyMap.set(day, 0);
  }
  for (const r of rows || []) {
    if (!r.created_at) continue;
    const day = r.created_at.slice(0, 10);
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) || 0) + (r.amount_net_eur || 0));
    }
  }
  const daily: DailyPoint[] = [];
  let cumul = 0;
  for (const [date, daily_ttc] of dailyMap) {
    cumul += daily_ttc;
    daily.push({
      date,
      daily_ttc,
      cumul_ttc: cumul,
      cumul_ht: cumul * (1 / 1.20),
    });
  }

  return {
    yearMonth,
    teamObj_eur: teamObj,
    totalCA_TTC,
    totalCA_HT: totalCA_TTC * (1 / 1.20),
    totalRows: rows?.length || 0,
    flaggedCount,
    autonomeNet,
    locked: !!run?.locked,
    negos,
    daily,
    totalCommissions: negos.reduce((s, n) => s + n.commission.amount_eur, 0),
  };
}
