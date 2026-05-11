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

export interface CompositionStat {
  label: string;
  count: number;
  ca: number;
  pct_ca: number; // % du CA total
}

export interface TopClient {
  email: string;
  client_name: string | null;
  ca: number;
  nb_charges: number;
  family: string | null;
}

export interface FunnelData {
  // Délai moyen entre la création d'un lead UTM et son 1er paiement (jours)
  // Calculé uniquement pour les clients qui ont une fiche dans leads (Supabase).
  avg_lead_to_payment_days: number | null;
  /** Nb de clients du mois qui ont matché un lead UTM */
  matched_lead_count: number;
  /** Nb d'interactions sales moyennes avant le closing (sales-touched uniquement) */
  avg_interactions_before_close: number | null;
  /** Nb de clients sales-touched (>= 1 effort traçable) */
  sales_touched_clients: number;
  /** Nb de clients self-service (zéro effort traçable) */
  self_service_clients: number;
  /** Délai moyen entre première interaction commerciale et paiement (jours, sales-touched) */
  avg_first_touch_to_payment_days: number | null;
}

export interface ReportData {
  yearMonth: string;
  teamObj_eur: number;
  totalCA_TTC: number;
  totalCA_HT: number;
  totalRows: number;
  totalClients: number; // emails uniques
  panierMoyen_charge: number; // CA TTC / nb charges
  panierMoyen_client: number; // CA TTC / nb clients uniques
  flaggedCount: number;
  autonomeNet: number;
  locked: boolean;
  negos: NegoLine[];
  daily: DailyPoint[];
  totalCommissions: number;
  // Nouvelles sections "rapport direction"
  newbizStats: CompositionStat[]; // NewBiz vs OldBiz
  sourceStats: CompositionStat[]; // Sales-touched / Self-service / Mid
  productStats: CompositionStat[]; // Par family
  topClients: TopClient[]; // Top 10 par CA
  concentrationTop10Pct: number; // % du CA fait par les top 10% clients
  basketDistribution: { label: string; nb_clients: number; ca: number }[]; // 1/2/3+ charges
  funnel: FunnelData;
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
    .select(
      "amount_net_eur, auto_commercial_id, override_commercial_id, flagged_for_review, created_at, email, client_name, family, newbiz_1m, newbiz_3m, auto_source, auto_score, last_efforts",
    )
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

  // ====== Section "rapport direction" : composition, funnel, top clients ======

  // 1) NewBiz vs OldBiz (basé sur la colonne newbiz_1m)
  const newbizMap = new Map<string, { count: number; ca: number }>();
  for (const r of rows || []) {
    const k = r.newbiz_1m || "Inconnu";
    const cur = newbizMap.get(k) || { count: 0, ca: 0 };
    cur.count++;
    cur.ca += r.amount_net_eur || 0;
    newbizMap.set(k, cur);
  }
  const newbizStats: CompositionStat[] = [...newbizMap.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      ca: v.ca,
      pct_ca: totalCA_TTC > 0 ? (v.ca / totalCA_TTC) * 100 : 0,
    }))
    .sort((a, b) => b.ca - a.ca);

  // 2) Sales-touched / Mid / Self-service (basé sur auto_source + auto_score)
  //   Sales-touched : effort commercial confirmé dans la fenêtre 90j (score >= 5)
  //   Mid           : owner identifié mais sans effort récent (score 2-4)
  //   Self-service  : aucun effort traçable (score 0)
  const sourceMap = new Map<string, { count: number; ca: number }>();
  function classifySource(score: number | null): "Sales-touched" | "Mid" | "Self-service" {
    const s = score || 0;
    if (s >= 5) return "Sales-touched";
    if (s >= 2) return "Mid";
    return "Self-service";
  }
  for (const r of rows || []) {
    const k = classifySource(r.auto_score);
    const cur = sourceMap.get(k) || { count: 0, ca: 0 };
    cur.count++;
    cur.ca += r.amount_net_eur || 0;
    sourceMap.set(k, cur);
  }
  const sourceOrder = ["Sales-touched", "Mid", "Self-service"];
  const sourceStats: CompositionStat[] = sourceOrder
    .map((k) => {
      const v = sourceMap.get(k) || { count: 0, ca: 0 };
      return {
        label: k,
        count: v.count,
        ca: v.ca,
        pct_ca: totalCA_TTC > 0 ? (v.ca / totalCA_TTC) * 100 : 0,
      };
    })
    .filter((s) => s.count > 0);

  // 3) Mix produits (family)
  const productMap = new Map<string, { count: number; ca: number }>();
  for (const r of rows || []) {
    const k = r.family || "Non catégorisé";
    const cur = productMap.get(k) || { count: 0, ca: 0 };
    cur.count++;
    cur.ca += r.amount_net_eur || 0;
    productMap.set(k, cur);
  }
  const productStats: CompositionStat[] = [...productMap.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      ca: v.ca,
      pct_ca: totalCA_TTC > 0 ? (v.ca / totalCA_TTC) * 100 : 0,
    }))
    .sort((a, b) => b.ca - a.ca);

  // 4) Top 10 clients par CA (GROUP BY email)
  type ClientAgg = { email: string; client_name: string | null; ca: number; nb_charges: number; family: string | null };
  const clientMap = new Map<string, ClientAgg>();
  for (const r of rows || []) {
    if (!r.email) continue;
    const cur = clientMap.get(r.email);
    if (cur) {
      cur.ca += r.amount_net_eur || 0;
      cur.nb_charges++;
      // Garde le family le plus "chiffré" (genre Abonnement > Autre)
      if (!cur.client_name && r.client_name) cur.client_name = r.client_name;
    } else {
      clientMap.set(r.email, {
        email: r.email,
        client_name: r.client_name,
        ca: r.amount_net_eur || 0,
        nb_charges: 1,
        family: r.family || null,
      });
    }
  }
  const allClients = [...clientMap.values()].sort((a, b) => b.ca - a.ca);
  const topClients: TopClient[] = allClients.slice(0, 10);
  // Concentration : % du CA fait par les top 10% clients
  const top10pctSize = Math.max(1, Math.ceil(allClients.length * 0.1));
  const top10pctCA = allClients.slice(0, top10pctSize).reduce((s, c) => s + c.ca, 0);
  const concentrationTop10Pct = totalCA_TTC > 0 ? (top10pctCA / totalCA_TTC) * 100 : 0;

  // 5) Distribution panier (1 / 2 / 3+ charges par client)
  const distMap = new Map<string, { nb_clients: number; ca: number }>();
  for (const c of allClients) {
    const bucket = c.nb_charges === 1 ? "1 charge" : c.nb_charges === 2 ? "2 charges" : "3+ charges";
    const cur = distMap.get(bucket) || { nb_clients: 0, ca: 0 };
    cur.nb_clients++;
    cur.ca += c.ca;
    distMap.set(bucket, cur);
  }
  const basketDistribution = ["1 charge", "2 charges", "3+ charges"]
    .filter((k) => distMap.has(k))
    .map((k) => ({ label: k, ...distMap.get(k)! }));

  // 6) Funnel — délai lead→payement via JOIN sur leads.email
  const emails = [...clientMap.keys()];
  let avgLeadToPaymentDays: number | null = null;
  let matchedLeadCount = 0;
  if (emails.length > 0) {
    const { data: leadRows } = await sb
      .from("leads")
      .select("email, created_at")
      .in("email", emails)
      .limit(500);
    const leadByEmail = new Map<string, string>();
    for (const l of leadRows || []) {
      if (!l.email) continue;
      // Prend la plus ancienne création (premier touchpoint)
      const existing = leadByEmail.get(l.email);
      if (!existing || l.created_at < existing) {
        leadByEmail.set(l.email, l.created_at);
      }
    }
    const deltas: number[] = [];
    for (const c of allClients) {
      const leadAt = leadByEmail.get(c.email);
      if (!leadAt) continue;
      // 1ère charge de ce client dans le mois
      const firstCharge = (rows || [])
        .filter((r) => r.email === c.email)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[0];
      if (!firstCharge) continue;
      const dt = new Date(firstCharge.created_at).getTime() - new Date(leadAt).getTime();
      if (dt > 0) {
        deltas.push(dt / (24 * 3600 * 1000));
        matchedLeadCount++;
      }
    }
    if (deltas.length > 0) {
      avgLeadToPaymentDays = deltas.reduce((s, n) => s + n, 0) / deltas.length;
    }
  }

  // Nb interactions moyennes avant closing (sales-touched uniquement)
  // last_efforts est un JSON array d'efforts trouvés dans la fenêtre 90j
  const interactionCounts: number[] = [];
  const firstTouchDeltas: number[] = [];
  for (const r of rows || []) {
    if ((r.auto_score || 0) < 5) continue;
    const efforts = (r.last_efforts || []) as Array<{ days_before?: number }>;
    if (Array.isArray(efforts) && efforts.length > 0) {
      interactionCounts.push(efforts.length);
      // Délai depuis la première interaction (= effort le plus ancien)
      const oldest = efforts.reduce(
        (acc, e) => (e.days_before !== undefined && e.days_before > acc ? e.days_before : acc),
        0,
      );
      if (oldest > 0) firstTouchDeltas.push(oldest);
    }
  }
  const avgInteractions =
    interactionCounts.length > 0
      ? interactionCounts.reduce((s, n) => s + n, 0) / interactionCounts.length
      : null;
  const avgFirstTouchDays =
    firstTouchDeltas.length > 0
      ? firstTouchDeltas.reduce((s, n) => s + n, 0) / firstTouchDeltas.length
      : null;

  const salesTouchedClients = sourceStats.find((s) => s.label === "Sales-touched")?.count || 0;
  const selfServiceClients = sourceStats.find((s) => s.label === "Self-service")?.count || 0;

  const funnel: FunnelData = {
    avg_lead_to_payment_days: avgLeadToPaymentDays,
    matched_lead_count: matchedLeadCount,
    avg_interactions_before_close: avgInteractions,
    sales_touched_clients: salesTouchedClients,
    self_service_clients: selfServiceClients,
    avg_first_touch_to_payment_days: avgFirstTouchDays,
  };

  const nbCharges = rows?.length || 0;
  const nbClients = clientMap.size;

  return {
    yearMonth,
    teamObj_eur: teamObj,
    totalCA_TTC,
    totalCA_HT: totalCA_TTC * (1 / 1.20),
    totalRows: nbCharges,
    totalClients: nbClients,
    panierMoyen_charge: nbCharges > 0 ? totalCA_TTC / nbCharges : 0,
    panierMoyen_client: nbClients > 0 ? totalCA_TTC / nbClients : 0,
    flaggedCount,
    autonomeNet,
    locked: !!run?.locked,
    negos,
    daily,
    totalCommissions: negos.reduce((s, n) => s + n.commission.amount_eur, 0),
    newbizStats,
    sourceStats,
    productStats,
    topClients,
    concentrationTop10Pct,
    basketDistribution,
    funnel,
  };
}
