// GET /api/admin/partners-revenue
//
// Calcule le CA Stripe net généré par les clients de chaque affilié.
//   - Source CA   : table `attribution_rows` (toutes les charges Stripe ingérées)
//   - Rattachement: table `leads` joint sur `email`
//
// Renvoie un breakdown par année + par partenaire.
//
// ⚠️ ADMIN-ONLY. Cet endpoint expose le revenu brut Stripe, à ne JAMAIS
// exposer côté partenaire (les routes /api/partner/* ne renvoient que la
// commission calculée, pas le CA).
//
// Gestion des doublons : si plusieurs partenaires ont un lead pour le même
// email, on attribue le revenu au **lead le plus ancien** (premier apporteur).
// Le partner_actions/source ne sont pas pris en compte ici (logique simple).

import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

export const maxDuration = 30;

interface YearTotal {
  year: number;
  ca: number;
  charges: number;
  uniqueClients: number;
}

interface PartnerRevenue {
  partner_id: string;
  partner_name: string;
  partner_code: string;
  partner_utm: string;
  active: boolean;
  total_ca: number;
  total_charges: number;
  unique_clients: number;
  by_year: Record<string, { ca: number; charges: number; clients: number }>;
}

interface AttributionRow {
  email: string;
  amount_net_eur: number | null;
  created_at: string;
}

interface LeadRow {
  partner_id: string;
  email: string;
  created_at: string;
}

interface PartnerRow {
  id: string;
  nom: string;
  code: string;
  utm: string;
  active: boolean;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createServiceClient();

  // 1) Pull all partners
  const { data: partners, error: partnersErr } = await supabase
    .from("partners")
    .select("id, nom, code, utm, active")
    .order("nom");
  if (partnersErr) {
    return NextResponse.json({ error: partnersErr.message }, { status: 500 });
  }
  const partnerById = new Map<string, PartnerRow>(
    (partners || []).map((p) => [p.id, p as PartnerRow]),
  );

  // 2) Pull all leads (id minimal pour la jointure)
  // On va prendre le LEAD le plus ancien par email pour éviter le double comptage
  // quand un même client a été lead par 2 partenaires différents.
  const { data: allLeads, error: leadsErr } = await supabase
    .from("leads")
    .select("partner_id, email, created_at")
    .order("created_at", { ascending: true });
  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  }

  const partnerByEmail = new Map<string, string>();
  for (const l of (allLeads || []) as LeadRow[]) {
    if (!l.email) continue;
    const emailKey = l.email.toLowerCase();
    if (!partnerByEmail.has(emailKey)) {
      partnerByEmail.set(emailKey, l.partner_id);
    }
  }

  // 3) Pull all attribution_rows (charges Stripe ingérées)
  // Pour la perf, on récupère uniquement les colonnes utiles et on pagine
  // implicitement via Supabase (qui retourne jusqu'à 1000 lignes par défaut).
  // On itère manuellement si besoin de plus.
  const PAGE_SIZE = 1000;
  const allCharges: AttributionRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("attribution_rows")
      .select("email, amount_net_eur, created_at")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    allCharges.push(...(data as AttributionRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 4) Aggregate par partenaire et par année
  const totalsByPartner = new Map<string, PartnerRevenue>();
  const totalsByYear = new Map<number, YearTotal>();
  const uniqueClientsByYear = new Map<number, Set<string>>();
  const uniqueClientsPartnerYear = new Map<string, Set<string>>(); // key: `${partnerId}|${year}`

  let unmatchedCa = 0;
  let unmatchedCharges = 0;
  const unmatchedClients = new Set<string>();

  let globalTotalCa = 0;
  let globalTotalCharges = 0;
  const globalUniqueClients = new Set<string>();

  for (const c of allCharges) {
    if (!c.email || c.amount_net_eur == null) continue;
    const amount = Number(c.amount_net_eur) || 0;
    if (amount <= 0) continue;
    const year = new Date(c.created_at).getUTCFullYear();
    if (isNaN(year)) continue;
    const emailKey = c.email.toLowerCase();

    globalTotalCa += amount;
    globalTotalCharges++;
    globalUniqueClients.add(emailKey);

    // Bucket par année (total tous partenaires inclus, et clients non rattachés)
    let yt = totalsByYear.get(year);
    if (!yt) {
      yt = { year, ca: 0, charges: 0, uniqueClients: 0 };
      totalsByYear.set(year, yt);
      uniqueClientsByYear.set(year, new Set());
    }
    yt.ca += amount;
    yt.charges++;
    uniqueClientsByYear.get(year)!.add(emailKey);

    const partnerId = partnerByEmail.get(emailKey);
    if (!partnerId) {
      unmatchedCa += amount;
      unmatchedCharges++;
      unmatchedClients.add(emailKey);
      continue;
    }

    const partner = partnerById.get(partnerId);
    if (!partner) continue; // lead orphelin (partner supprimé)

    let pr = totalsByPartner.get(partnerId);
    if (!pr) {
      pr = {
        partner_id: partnerId,
        partner_name: partner.nom,
        partner_code: partner.code,
        partner_utm: partner.utm,
        active: partner.active,
        total_ca: 0,
        total_charges: 0,
        unique_clients: 0,
        by_year: {},
      };
      totalsByPartner.set(partnerId, pr);
    }
    pr.total_ca += amount;
    pr.total_charges++;

    if (!pr.by_year[year]) {
      pr.by_year[year] = { ca: 0, charges: 0, clients: 0 };
    }
    pr.by_year[year].ca += amount;
    pr.by_year[year].charges++;

    const pyKey = `${partnerId}|${year}`;
    if (!uniqueClientsPartnerYear.has(pyKey)) {
      uniqueClientsPartnerYear.set(pyKey, new Set());
    }
    uniqueClientsPartnerYear.get(pyKey)!.add(emailKey);
  }

  // Finalize unique counts
  for (const pr of totalsByPartner.values()) {
    const allEmails = new Set<string>();
    for (const year of Object.keys(pr.by_year)) {
      const set = uniqueClientsPartnerYear.get(`${pr.partner_id}|${year}`);
      if (set) {
        pr.by_year[year].clients = set.size;
        for (const e of set) allEmails.add(e);
      }
    }
    pr.unique_clients = allEmails.size;
  }
  for (const [year, set] of uniqueClientsByYear) {
    const yt = totalsByYear.get(year);
    if (yt) yt.uniqueClients = set.size;
  }

  // Trier
  const byYearArr = Array.from(totalsByYear.values()).sort((a, b) => b.year - a.year);
  const byPartnerArr = Array.from(totalsByPartner.values()).sort(
    (a, b) => b.total_ca - a.total_ca,
  );

  return NextResponse.json({
    total: {
      ca: Math.round(globalTotalCa),
      charges: globalTotalCharges,
      unique_clients: globalUniqueClients.size,
    },
    matched: {
      ca: Math.round(globalTotalCa - unmatchedCa),
      charges: globalTotalCharges - unmatchedCharges,
      unique_clients: globalUniqueClients.size - unmatchedClients.size,
    },
    unmatched: {
      ca: Math.round(unmatchedCa),
      charges: unmatchedCharges,
      unique_clients: unmatchedClients.size,
    },
    by_year: byYearArr.map((y) => ({ ...y, ca: Math.round(y.ca) })),
    by_partner: byPartnerArr.map((p) => ({
      ...p,
      total_ca: Math.round(p.total_ca),
      by_year: Object.fromEntries(
        Object.entries(p.by_year).map(([y, v]) => [
          y,
          { ...v, ca: Math.round(v.ca) },
        ]),
      ),
    })),
  });
}
