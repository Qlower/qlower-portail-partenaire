// GET /api/admin/invoices/billing-overview?year=2026
// Renvoie UNE ligne par (partenaire actif, année), avec :
//   - commission calculée pour cette année
//   - invoice associée (si elle existe en DB) ou null
//   - statut calculé : to_pay | waiting_invoice | not_called | paid | paid_no_invoice | historical | no_commission
// Permet à l'admin une vue plate "facturation" filtrable par statut, sans avoir
// à déplier 30 accordéons.
//
// Stratégie : un seul fetch HubSpot pour TOUS les contacts, puis groupement par
// UTM en mémoire. Calcul commission par partenaire pour la seule année demandée.

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

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

type HSContact = { id: string; properties: Record<string, string | null> };

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
    for (const c of data.results || [])
      contacts.push({ id: c.id, properties: c.properties });
    after = data.paging?.next?.after;
  } while (after);
  return contacts;
}

// Commission pour UNE année cible (réutilise la même logique que partners-commissions
// mais limitée à un seul `targetYear` au lieu de sommer toutes les années).
function computeCommissionForYear(
  partnerContacts: HSContact[],
  rules: Rule[],
  biensMoyens: number,
  caParClient: number,
  contractYear: number | null,
  targetYear: number,
): { subscribers: number; commission: number } {
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

    // Conditions pour qu'on commissionne cet abonné cette année-là
    if (targetYear < subYear) continue;
    if (contractYear !== null && targetYear < contractYear) continue;
    if (unsubYear && subYear === unsubYear) continue;
    if (!isCurrentlySubscriber) {
      if (!unsubYear) continue;
      if (targetYear > unsubYear) continue;
    }

    let amount = 0;
    if (useLegacyDefault) {
      amount = LEGACY_ANNUAL;
    } else {
      if (annuelleRule?.montant) amount += annuelleRule.montant;
      if (pctRule?.pct && pctAmount > 0) amount += pctAmount;
      if (targetYear === subYear && !isResubscription) {
        if (souscRule?.montant) amount += souscRule.montant;
        if (biensRule && biensMontant > 0) amount += biensMontant;
      }
    }

    if (amount > 0) {
      totalSubs++;
      totalCom += amount;
    }
  }

  return { subscribers: totalSubs, commission: totalCom };
}

type BillingRow = {
  partner_id: string;
  partner_name: string;
  partner_email: string | null;
  partner_code: string;
  commission_ht: boolean;
  contract_signed_at: string | null;
  year: number;
  commission: number;
  subscribers: number;
  invoice: {
    id: string;
    file_url: string | null;
    is_paid: boolean;
    historical: boolean;
    uploaded_at: string | null;
    paid_at: string | null;
    amount: number;
    notes: string | null;
  } | null;
  status:
    | "to_pay"            // facture reçue, en attente paiement → 1-click "marquer payée"
    | "waiting_invoice"   // placeholder créé (appel envoyé), partenaire n'a pas uploadé
    | "not_called"        // commission due, aucune ligne en DB → "envoyer appel"
    | "paid"              // payée
    | "paid_no_invoice"   // payée hors facture (cash/virement direct)
    | "historical"        // facture historique
    | "no_commission";    // aucune commission cette année, à ignorer
};

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const yearStr = searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
  if (isNaN(year)) {
    return NextResponse.json({ error: "year must be a number" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1) Partenaires actifs
  const { data: partners } = await supabase
    .from("partners")
    .select(
      "id, nom, email, code, utm, comm_rules, biens_moyens, ca_par_client, commission_ht, contract_signed_at",
    )
    .eq("active", true)
    .order("nom");

  if (!partners) return NextResponse.json({ rows: [], year });

  // 2) Factures DB pour cette année
  const partnerIds = partners.map((p) => p.id);
  const { data: invoices } = await supabase
    .from("partner_invoices")
    .select("id, partner_id, year, amount, file_url, is_paid, historical, uploaded_at, paid_at, notes")
    .in("partner_id", partnerIds)
    .eq("year", year);
  const invByPartner = new Map<string, NonNullable<typeof invoices>[number]>();
  for (const inv of invoices || []) invByPartner.set(inv.partner_id, inv);

  // 3) Contacts HubSpot (1 seul fetch, paginé)
  const allContacts = await fetchAllPartnerContacts();
  // Index case-insensitive (HubSpot enum peut avoir un casing différent de partners.utm)
  const byUtm = new Map<string, HSContact[]>();
  for (const c of allContacts) {
    const utm = c.properties.partenaire__lead_ || c.properties.utm_source;
    if (!utm) continue;
    const key = utm.toLowerCase();
    if (!byUtm.has(key)) byUtm.set(key, []);
    byUtm.get(key)!.push(c);
  }

  // 4) Compute per-partner status pour year sélectionnée
  const rows: BillingRow[] = partners.map((p) => {
    const partnerContacts = byUtm.get((p.utm || "").toLowerCase()) || [];
    const contractYear = p.contract_signed_at
      ? new Date(p.contract_signed_at).getFullYear()
      : null;

    // Si année avant signature, on ignore (commission = 0 garantie)
    const isBeforeContract = contractYear !== null && year < contractYear;
    const { subscribers, commission } = isBeforeContract
      ? { subscribers: 0, commission: 0 }
      : computeCommissionForYear(
          partnerContacts,
          (p.comm_rules || []) as Rule[],
          p.biens_moyens ?? 2,
          p.ca_par_client ?? 0,
          contractYear,
          year,
        );

    const inv = invByPartner.get(p.id) ?? null;

    // Status logic — ordre important
    let status: BillingRow["status"];
    if (inv?.historical) {
      status = "historical";
    } else if (inv?.is_paid && inv?.file_url) {
      status = "paid";
    } else if (inv?.is_paid && !inv?.file_url) {
      status = "paid_no_invoice";
    } else if (inv?.file_url && !inv?.is_paid) {
      status = "to_pay";
    } else if (inv && !inv.file_url && !inv.is_paid) {
      status = "waiting_invoice";
    } else if (!inv && commission > 0) {
      status = "not_called";
    } else {
      status = "no_commission";
    }

    return {
      partner_id: p.id,
      partner_name: p.nom,
      partner_email: p.email ?? null,
      partner_code: p.code,
      commission_ht: !!p.commission_ht,
      contract_signed_at: p.contract_signed_at,
      year,
      commission,
      subscribers,
      invoice: inv
        ? {
            id: inv.id,
            file_url: inv.file_url,
            is_paid: !!inv.is_paid,
            historical: !!inv.historical,
            uploaded_at: inv.uploaded_at,
            paid_at: inv.paid_at,
            amount: Number(inv.amount) || 0,
            notes: inv.notes ?? null,
          }
        : null,
      status,
    };
  });

  return NextResponse.json({ rows, year });
}
