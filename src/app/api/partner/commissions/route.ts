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
  "lifecyclestage",
];

// GET /api/partner/commissions?partner_id=xxx&year=2026
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get("partner_id");
  const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

  if (!partnerId) {
    return NextResponse.json({ error: "partner_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get partner UTM, commission rules and volumetric attributes
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
        {
          filters: [
            { propertyName: "partenaire__lead_", operator: "EQ", value: partner.utm },
          ],
        },
      ],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;

    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  // ── Extract active commission rules from admin config ────────
  type Tranche = { max: number; montant: number };
  type Rule = {
    type: "souscription" | "annuelle" | "biens" | "pct_ca";
    montant?: number;
    pct?: number;
    tranches?: Tranche[];
    actif: boolean;
  };

  const rules = (partner.comm_rules || []) as Rule[];
  const activeRules = rules.filter((r) => r.actif);
  const souscRule = activeRules.find((r) => r.type === "souscription");
  const annuelleRule = activeRules.find((r) => r.type === "annuelle");
  const biensRule = activeRules.find((r) => r.type === "biens");
  const pctRule = activeRules.find((r) => r.type === "pct_ca");

  // Legacy fallback: if NO rule is active, default to 100€/year per subscriber
  // (preserves existing partner behaviour until admin configures explicit rules)
  const useLegacyDefault = activeRules.length === 0;
  const LEGACY_ANNUAL = 100;

  // Biens tranche resolved from partner.biens_moyens
  const biensMoyens = partner.biens_moyens ?? 2;
  const biensTranches = biensRule?.tranches ?? [];
  const biensMontant = (() => {
    if (!biensRule) return 0;
    const hit = biensTranches.find((x) => biensMoyens <= x.max);
    return (hit || biensTranches[biensTranches.length - 1])?.montant || 0;
  })();

  // % CA resolved from partner.ca_par_client
  const caParClient = partner.ca_par_client ?? 0;
  const pctAmount = pctRule?.pct ? Math.round((caParClient * pctRule.pct) / 100) : 0;

  // Rule breakdown for UI (all active rules with resolved amount)
  const ruleDetails: Array<{ label: string; montant: number; type: "one_shot" | "recurring" }> = [];
  if (souscRule?.montant) ruleDetails.push({ label: "Souscription", montant: souscRule.montant, type: "one_shot" });
  if (biensRule && biensMontant > 0) ruleDetails.push({ label: `Variable biens (${biensMoyens} biens/client)`, montant: biensMontant, type: "one_shot" });
  if (annuelleRule?.montant) ruleDetails.push({ label: "Annuelle", montant: annuelleRule.montant, type: "recurring" });
  if (pctRule?.pct && pctAmount > 0) ruleDetails.push({ label: `% CA (${pctRule.pct}%)`, montant: pctAmount, type: "recurring" });
  if (useLegacyDefault) ruleDetails.push({ label: "Annuelle (défaut)", montant: LEGACY_ANNUAL, type: "recurring" });

  /**
   * Commission contributed by a single subscriber for a given target year.
   * - Entry year: one-shot rules (souscription, biens) + recurring (annuelle, %CA)
   * - Later years while active: recurring only (annuelle, %CA)
   * - Legacy mode (no rule active): 100€ flat only in entry year (preserves old behavior)
   */
  function commissionForSubscriber(subYear: number, targetYear: number): number {
    if (subYear > targetYear) return 0;

    if (useLegacyDefault) {
      return subYear === targetYear ? LEGACY_ANNUAL : 0;
    }

    let amount = 0;
    // One-shot rules paid only in entry year
    if (subYear === targetYear) {
      if (souscRule?.montant) amount += souscRule.montant;
      if (biensRule && biensMontant > 0) amount += biensMontant;
    }
    // Recurring rules paid every active year (including entry year)
    if (annuelleRule?.montant) amount += annuelleRule.montant;
    if (pctRule?.pct && pctAmount > 0) amount += pctAmount;
    return amount;
  }

  // ── Aggregate per month for selected year + totals for previous year ──
  const monthlyData: Record<
    number,
    { subscribers: string[]; count: number; commission: number }
  > = {};
  for (let m = 1; m <= 12; m++) {
    monthlyData[m] = { subscribers: [], count: 0, commission: 0 };
  }

  const previousYearMonthly: Record<number, { count: number; commission: number }> = {};
  for (let m = 1; m <= 12; m++) {
    previousYearMonthly[m] = { count: 0, commission: 0 };
  }

  let totalSubscribersCurrentYear = 0;
  let totalCommissionCurrentYear = 0;
  let totalSubscribersPreviousYear = 0;
  let totalCommissionPreviousYear = 0;

  for (const contact of contacts) {
    const dateStr = contact.properties.hs_v2_date_entered_999998694;
    if (!dateStr) continue; // Never entered subscriber stage

    const exitDateStr = contact.properties.hs_v2_date_exited_999998694;
    const currentLifecycle = (contact.properties.lifecyclestage || "").toLowerCase();
    const isCurrentlySubscriber = currentLifecycle === "999998694";
    const enteredAndNeverExited = !exitDateStr;
    if (!isCurrentlySubscriber && !enteredAndNeverExited) continue; // Churned

    const subDate = new Date(dateStr);
    const subYear = subDate.getFullYear();
    const subMonth = subDate.getMonth() + 1;
    const name =
      [contact.properties.firstname, contact.properties.lastname]
        .filter(Boolean)
        .join(" ") || contact.properties.email || "Inconnu";

    // Current year contribution
    const curCom = commissionForSubscriber(subYear, year);
    if (curCom > 0) {
      totalSubscribersCurrentYear++;
      totalCommissionCurrentYear += curCom;
      monthlyData[subMonth].count++;
      monthlyData[subMonth].commission += curCom;
      monthlyData[subMonth].subscribers.push(name);
    }

    // Previous year contribution
    const prevCom = commissionForSubscriber(subYear, year - 1);
    if (prevCom > 0) {
      totalSubscribersPreviousYear++;
      totalCommissionPreviousYear += prevCom;
      previousYearMonthly[subMonth].count++;
      previousYearMonthly[subMonth].commission += prevCom;
    }
  }

  // Steady-state recurring amount per subscriber (for the "× X€" display)
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
      previousYear: previousYearMonthly[m].count,
      previousYearCommission: previousYearMonthly[m].commission,
    });
  }

  return NextResponse.json({
    year,
    partnerId,
    montantParAbonne,
    ruleDetails,
    totalSubscribers: totalSubscribersCurrentYear,
    totalCommission: totalCommissionCurrentYear,
    previousYear: {
      year: year - 1,
      totalSubscribers: totalSubscribersPreviousYear,
      totalCommission: totalCommissionPreviousYear,
    },
    months,
    totalContacts: contacts.length,
  });
}
