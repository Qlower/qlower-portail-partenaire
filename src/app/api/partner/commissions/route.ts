import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

const PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "partenaire__lead_",
  "hs_v2_date_entered_999998694",
  "hs_v2_date_exited_999998694",
  "date_premier_paiement_abonnement",
  "lifecyclestage",
];

// ── Types ────────────────────────────────────────────────────
type Tranche = { max: number; montant: number };
type Rule = {
  type: "souscription" | "annuelle" | "biens" | "pct_ca";
  montant?: number;
  pct?: number;
  tranches?: Tranche[];
  actif: boolean;
};

type SubscriberDetail = {
  name: string;
  commission: number;
  entryDate: string; // ISO
  exitDate: string | null;
  isCurrentlySubscriber: boolean;
  isResubscription: boolean; // currently sub, but had a previous exit
  unsubscribedDuringYear: boolean; // unsubYear === targetYear (shows "Désabonné" badge on that year)
};

// GET /api/partner/commissions?partner_id=xxx&year=2026
// year=all -> cumulative view across all years (for dashboard "Toutes années")
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const yearParam = searchParams.get("year") || new Date().getFullYear().toString();
  const isAllYears = yearParam === "all";
  const year = isAllYears ? new Date().getFullYear() : parseInt(yearParam);

  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("utm, comm_rules, biens_moyens, ca_par_client")
    .eq("id", partnerId)
    .single();

  if (partnerError || !partner) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  // Fetch all HubSpot contacts for this partner
  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        { filters: [{ propertyName: "partenaire__lead_", operator: "EQ", value: partner.utm }] },
      ],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  // ── Extract active commission rules ─────────────────────────
  const rules = (partner.comm_rules || []) as Rule[];
  const activeRules = rules.filter((r) => r.actif);
  const souscRule = activeRules.find((r) => r.type === "souscription");
  const annuelleRule = activeRules.find((r) => r.type === "annuelle");
  const biensRule = activeRules.find((r) => r.type === "biens");
  const pctRule = activeRules.find((r) => r.type === "pct_ca");

  const useLegacyDefault = activeRules.length === 0;
  const LEGACY_ANNUAL = 100;

  const biensMoyens = partner.biens_moyens ?? 2;
  const biensTranches = biensRule?.tranches ?? [];
  const biensMontant = (() => {
    if (!biensRule) return 0;
    const hit = biensTranches.find((x) => biensMoyens <= x.max);
    return (hit || biensTranches[biensTranches.length - 1])?.montant || 0;
  })();

  const caParClient = partner.ca_par_client ?? 0;
  const pctAmount = pctRule?.pct ? Math.round((caParClient * pctRule.pct) / 100) : 0;

  // Rule breakdown for UI
  const ruleDetails: Array<{ label: string; montant: number; type: "one_shot" | "recurring" }> = [];
  if (souscRule?.montant) ruleDetails.push({ label: "Souscription", montant: souscRule.montant, type: "one_shot" });
  if (biensRule && biensMontant > 0) ruleDetails.push({ label: `Variable biens (${biensMoyens} biens/client)`, montant: biensMontant, type: "one_shot" });
  if (annuelleRule?.montant) ruleDetails.push({ label: "Annuelle", montant: annuelleRule.montant, type: "recurring" });
  if (pctRule?.pct && pctAmount > 0) ruleDetails.push({ label: `% CA (${pctRule.pct}%)`, montant: pctAmount, type: "recurring" });
  if (useLegacyDefault) ruleDetails.push({ label: "Annuelle (défaut)", montant: LEGACY_ANNUAL, type: "recurring" });

  /**
   * Compute commission for a single subscriber in a given target year.
   *
   * Rules (Qlower affiliate commission model):
   * - Commission is EARNED the year the subscriber was active (invoicing happens in N+1 but that's accounting).
   * - Same-year churn (subYear === unsubYear) → never any commission.
   * - Different-year churn → commission for subYear through unsubYear inclusive.
   * - Currently subscribed → commission from subYear onwards, exit date ignored (it's from a prior cycle).
   * - Souscription / biens (one-shot rules) apply only in subYear AND only if this is an ORIGINAL first cycle
   *   (no exit date at all). Re-subscriptions don't re-trigger the one-shot bonus.
   * - Annuelle / %CA (recurring rules) apply every active year.
   */
  function commissionForSubscriber(
    subYear: number,
    unsubYear: number | null,
    isCurrentlySubscriber: boolean,
    isResubscription: boolean,
    targetYear: number
  ): number {
    if (targetYear < subYear) return 0;

    if (!isCurrentlySubscriber) {
      if (!unsubYear) return 0; // edge case: left stage but no exit date
      if (subYear === unsubYear) return 0; // same-year churn
      if (targetYear > unsubYear) return 0; // already gone
    }
    // Currently subscribed: ignore unsubYear (prior cycle)

    if (useLegacyDefault) {
      return LEGACY_ANNUAL;
    }

    let amount = 0;

    // Recurring rules — every active year
    if (annuelleRule?.montant) amount += annuelleRule.montant;
    if (pctRule?.pct && pctAmount > 0) amount += pctAmount;

    // One-shot rules — paid in subYear, but NOT redeclenched on a resub
    // (isResubscription means: currently subscribed AND has a prior exit before current entry)
    if (targetYear === subYear && !isResubscription) {
      if (souscRule?.montant) amount += souscRule.montant;
      if (biensRule && biensMontant > 0) amount += biensMontant;
    }

    return amount;
  }

  // ── Aggregate per month + build subscriber details ──────────
  const monthlyData: Record<
    number,
    { subscribers: string[]; details: SubscriberDetail[]; count: number; commission: number }
  > = {};
  for (let m = 1; m <= 12; m++) {
    monthlyData[m] = { subscribers: [], details: [], count: 0, commission: 0 };
  }

  const previousYearMonthly: Record<number, { count: number; commission: number }> = {};
  for (let m = 1; m <= 12; m++) {
    previousYearMonthly[m] = { count: 0, commission: 0 };
  }

  let totalSubscribersCurrentYear = 0;
  let totalCommissionCurrentYear = 0;
  let totalSubscribersPreviousYear = 0;
  let totalCommissionPreviousYear = 0;

  // For "all years" mode, also track cumulative commission from earliest year to current
  let cumulCommissionAllYears = 0;
  let cumulSubscribersCountedInAllYears = 0;

  for (const contact of contacts) {
    // Source principale : date_premier_paiement_abonnement (immuable, business-accurate)
    // Fallback : hs_v2_date_entered_999998694 (dernière entrée au stage, peut être écrasé)
    const firstPaidStr = contact.properties.date_premier_paiement_abonnement;
    const entryDateStr = firstPaidStr || contact.properties.hs_v2_date_entered_999998694;
    if (!entryDateStr) continue; // never paid / never entered subscriber stage

    const exitDateStr = contact.properties.hs_v2_date_exited_999998694;
    const hsEnteredStr = contact.properties.hs_v2_date_entered_999998694;
    const currentLifecycle = (contact.properties.lifecyclestage || "").toLowerCase();
    const isCurrentlySubscriber = currentLifecycle === "999998694";

    // HubSpot glitch detection: if hs entered & exited are within 60s, it's a
    // bulk re-processing, not a real churn. We discard the exit date.
    let effectiveExitStr: string | null = exitDateStr ?? null;
    if (hsEnteredStr && exitDateStr) {
      const eD = new Date(hsEnteredStr).getTime();
      const xD = new Date(exitDateStr).getTime();
      if (Math.abs(eD - xD) < 60000) {
        effectiveExitStr = null;
      }
    }
    // (unused in commission calc — resub detection uses effectiveExit comparison below)

    const entryDate = new Date(entryDateStr);
    const subYear = entryDate.getFullYear();
    const subMonth = entryDate.getMonth() + 1;

    const exitDate = effectiveExitStr ? new Date(effectiveExitStr) : null;
    const unsubYear = exitDate ? exitDate.getFullYear() : null;

    // A re-subscription is someone currently subscribed who has a prior exit (exit < entry),
    // and NOT a HubSpot glitch (already filtered into effectiveExitStr above).
    const isResubscription = isCurrentlySubscriber && !!exitDate && exitDate < entryDate;

    const name =
      [contact.properties.firstname, contact.properties.lastname]
        .filter(Boolean)
        .join(" ") || contact.properties.email || "Inconnu";

    // Current year
    const curCom = commissionForSubscriber(subYear, unsubYear, isCurrentlySubscriber, isResubscription, year);
    if (curCom > 0) {
      totalSubscribersCurrentYear++;
      totalCommissionCurrentYear += curCom;
      monthlyData[subMonth].count++;
      monthlyData[subMonth].commission += curCom;
      monthlyData[subMonth].subscribers.push(name);
      monthlyData[subMonth].details.push({
        name,
        commission: curCom,
        entryDate: entryDateStr,
        exitDate: exitDateStr,
        isCurrentlySubscriber,
        isResubscription,
        unsubscribedDuringYear: unsubYear === year,
      });
    }

    // Previous year (for the month-by-month comparison)
    const prevCom = commissionForSubscriber(subYear, unsubYear, isCurrentlySubscriber, isResubscription, year - 1);
    if (prevCom > 0) {
      totalSubscribersPreviousYear++;
      totalCommissionPreviousYear += prevCom;
      previousYearMonthly[subMonth].count++;
      previousYearMonthly[subMonth].commission += prevCom;
    }

    // Cumul "Toutes années" : on additionne la commission de chaque année
    // depuis subYear jusqu'à l'année courante (ou unsubYear si désabonné)
    if (isAllYears) {
      let contribSum = 0;
      const nowYear = new Date().getFullYear();
      for (let y = subYear; y <= nowYear; y++) {
        contribSum += commissionForSubscriber(subYear, unsubYear, isCurrentlySubscriber, isResubscription, y);
      }
      if (contribSum > 0) {
        cumulCommissionAllYears += contribSum;
        cumulSubscribersCountedInAllYears++;
      }
    }
  }

  // Display helper: per-subscriber steady-state recurring amount
  const montantParAbonne = useLegacyDefault
    ? LEGACY_ANNUAL
    : (annuelleRule?.montant || 0) + pctAmount;

  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const months = [];
  for (let m = 1; m <= 12; m++) {
    months.push({
      month: m,
      label: monthNames[m - 1],
      subscribers: monthlyData[m].count,
      commission: monthlyData[m].commission,
      subscriberNames: monthlyData[m].subscribers,
      subscriberDetails: monthlyData[m].details,
      previousYear: previousYearMonthly[m].count,
      previousYearCommission: previousYearMonthly[m].commission,
    });
  }

  return NextResponse.json({
    year: isAllYears ? "all" : year,
    partnerId,
    montantParAbonne,
    ruleDetails,
    totalSubscribers: isAllYears ? cumulSubscribersCountedInAllYears : totalSubscribersCurrentYear,
    totalCommission: isAllYears ? cumulCommissionAllYears : totalCommissionCurrentYear,
    previousYear: {
      year: year - 1,
      totalSubscribers: totalSubscribersPreviousYear,
      totalCommission: totalCommissionPreviousYear,
    },
    months,
    totalContacts: contacts.length,
    isAllYears,
  });
}
