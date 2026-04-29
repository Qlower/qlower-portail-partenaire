import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

// Vercel function timeout (HubSpot pagination can take 20-40s for ~400 contacts)
export const maxDuration = 60;

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

type Tranche = { max: number; montant: number };
type Rule = {
  type: "souscription" | "annuelle" | "biens" | "pct_ca";
  montant?: number;
  pct?: number;
  tranches?: Tranche[];
  actif: boolean;
};

type HSContact = {
  id: string;
  properties: Record<string, string | null>;
};

// Fetch ALL HubSpot contacts that have a partenaire__lead_ set, in one pass.
async function fetchAllPartnerContacts(): Promise<HSContact[]> {
  const contacts: HSContact[] = [];
  let after: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        { filters: [{ propertyName: "partenaire__lead_", operator: "HAS_PROPERTY" }] },
      ],
      properties: [
        "partenaire__lead_",
        "utm_source",
        "hs_v2_date_entered_999998694",
        "hs_v2_date_exited_999998694",
        "date_premier_paiement_abonnement",
        "lifecyclestage",
      ],
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
    for (const c of data.results || []) contacts.push({ id: c.id, properties: c.properties });
    after = data.paging?.next?.after;
  } while (after);
  return contacts;
}

function computeCommissionAllYears(
  partnerContacts: HSContact[],
  rules: Rule[],
  biensMoyens: number,
  caParClient: number,
  contractYear: number | null
): { totalSubscribers: number; totalCommission: number } {
  const activeRules = rules.filter((r) => r.actif);
  const souscRule = activeRules.find((r) => r.type === "souscription");
  const annuelleRule = activeRules.find((r) => r.type === "annuelle");
  const biensRule = activeRules.find((r) => r.type === "biens");
  const pctRule = activeRules.find((r) => r.type === "pct_ca");
  const useLegacyDefault = activeRules.length === 0;
  const LEGACY_ANNUAL = 100;

  const biensTranches = biensRule?.tranches ?? [];
  const biensMontant = (() => {
    if (!biensRule) return 0;
    const hit = biensTranches.find((x) => biensMoyens <= x.max);
    return (hit || biensTranches[biensTranches.length - 1])?.montant || 0;
  })();
  const pctAmount = pctRule?.pct ? Math.round((caParClient * pctRule.pct) / 100) : 0;

  const commissionForSubscriber = (
    subYear: number,
    unsubYear: number | null,
    isCurrentlySubscriber: boolean,
    isResubscription: boolean,
    targetYear: number
  ): number => {
    if (targetYear < subYear) return 0;
    if (contractYear !== null && targetYear < contractYear) return 0;
    if (unsubYear && subYear === unsubYear) return 0; // same-year churn
    if (!isCurrentlySubscriber) {
      if (!unsubYear) return 0;
      if (targetYear > unsubYear) return 0;
    }
    if (useLegacyDefault) return LEGACY_ANNUAL;
    let amount = 0;
    if (annuelleRule?.montant) amount += annuelleRule.montant;
    if (pctRule?.pct && pctAmount > 0) amount += pctAmount;
    if (targetYear === subYear && !isResubscription) {
      if (souscRule?.montant) amount += souscRule.montant;
      if (biensRule && biensMontant > 0) amount += biensMontant;
    }
    return amount;
  };

  const nowYear = new Date().getFullYear();
  let totalSubs = 0;
  let totalCom = 0;

  for (const contact of partnerContacts) {
    const firstPaidStr = contact.properties.date_premier_paiement_abonnement;
    const entryDateStr = firstPaidStr || contact.properties.hs_v2_date_entered_999998694;
    if (!entryDateStr) continue;

    const exitDateStr = contact.properties.hs_v2_date_exited_999998694;
    const hsEnteredStr = contact.properties.hs_v2_date_entered_999998694;
    const currentLifecycle = (contact.properties.lifecyclestage || "").toLowerCase();
    const isCurrentlySubscriber = currentLifecycle === "999998694";

    let effectiveExitStr: string | null = exitDateStr ?? null;
    if (hsEnteredStr && exitDateStr) {
      const eD = new Date(hsEnteredStr).getTime();
      const xD = new Date(exitDateStr).getTime();
      if (Math.abs(eD - xD) < 60000) effectiveExitStr = null;
    }

    const entryDate = new Date(entryDateStr);
    const subYear = entryDate.getFullYear();
    const exitDate = effectiveExitStr ? new Date(effectiveExitStr) : null;
    const unsubYear = exitDate ? exitDate.getFullYear() : null;
    const isResubscription = isCurrentlySubscriber && !!exitDate && exitDate < entryDate;

    let contribSum = 0;
    for (let y = subYear; y <= nowYear; y++) {
      contribSum += commissionForSubscriber(subYear, unsubYear, isCurrentlySubscriber, isResubscription, y);
    }
    if (contribSum > 0) {
      totalSubs++;
      totalCom += contribSum;
    }
  }

  return { totalSubscribers: totalSubs, totalCommission: totalCom };
}

// GET /api/admin/partners-commissions
// Single HubSpot fetch + in-memory grouping by UTM = fast (1 API call vs 30)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("id, utm, comm_rules, biens_moyens, ca_par_client, commission_ht, contract_signed_at")
    .eq("active", true);

  if (!partners) return NextResponse.json([]);

  const allContacts = await fetchAllPartnerContacts();

  // Index contacts by UTM (partenaire__lead_)
  const byUtm = new Map<string, HSContact[]>();
  for (const c of allContacts) {
    const utm = c.properties.partenaire__lead_ || c.properties.utm_source;
    if (!utm) continue;
    if (!byUtm.has(utm)) byUtm.set(utm, []);
    byUtm.get(utm)!.push(c);
  }

  const results = partners.map((p) => {
    const partnerContacts = byUtm.get(p.utm) || [];
    const contractYear = p.contract_signed_at
      ? new Date(p.contract_signed_at).getFullYear()
      : null;
    const { totalSubscribers, totalCommission } = computeCommissionAllYears(
      partnerContacts,
      (p.comm_rules || []) as Rule[],
      p.biens_moyens ?? 2,
      p.ca_par_client ?? 0,
      contractYear
    );
    return { partnerId: p.id, totalSubscribers, totalCommission, commissionHt: !!p.commission_ht };
  });

  return NextResponse.json(results);
}
