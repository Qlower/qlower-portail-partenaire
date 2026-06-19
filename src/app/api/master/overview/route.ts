// GET /api/master/overview
//
// Vue consolidée SIÈGE (réseau) : agrège les agences du réseau du master
// connecté. Le network_id vient de la session (verifyMaster), jamais de l'URL.
//
// Pilote = acquisition + CA (le détail rétrocession "par ligne" arrivera avec
// le moteur dédié). Les KPI de production fiscale restent sur Metabase.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { verifyMaster } from "@/lib/master-auth";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = await verifyMaster(request);
  if (auth.error) return auth.error;
  const networkId = auth.networkId as string;
  const sb = createServiceClient();

  const { data: network } = await sb
    .from("networks")
    .select("id, nom, statut, brand_label, objectif")
    .eq("id", networkId)
    .maybeSingle();

  // Les agences du réseau (on n'exclut PAS is_test : le master voit ses propres
  // agences ; is_test ne sert qu'à isoler des chiffres GLOBAUX Qlower).
  const { data: partners } = await sb
    .from("partners")
    .select("id, nom, code, leads, abonnes")
    .eq("network_id", networkId)
    .order("nom");
  const partnerList = partners || [];
  const ids = partnerList.map((p) => p.id);

  // CA généré par agence : match attribution_rows (Stripe) par email des leads.
  const caByPartner = new Map<string, number>();
  if (ids.length > 0) {
    const { data: leads } = await sb
      .from("leads")
      .select("email, partner_id")
      .in("partner_id", ids)
      .not("email", "is", null);
    const partnerByEmail = new Map<string, string>();
    for (const l of leads || []) {
      if (!l.email) continue;
      const e = l.email.toLowerCase();
      if (!partnerByEmail.has(e)) partnerByEmail.set(e, l.partner_id);
    }
    const emails = [...new Set((leads || []).map((l) => l.email as string))];
    for (let i = 0; i < emails.length; i += 200) {
      const chunk = emails.slice(i, i + 200);
      const { data: rows } = await sb
        .from("attribution_rows")
        .select("email, amount_net_eur")
        .in("email", chunk);
      for (const r of rows || []) {
        const amt = Number(r.amount_net_eur) || 0;
        if (amt <= 0) continue;
        const pid = partnerByEmail.get((r.email || "").toLowerCase());
        if (!pid) continue;
        caByPartner.set(pid, (caByPartner.get(pid) || 0) + amt);
      }
    }
  }

  const agencies = partnerList
    .map((p) => ({
      id: p.id,
      nom: p.nom,
      code: p.code,
      bailleurs: p.abonnes || 0,
      leads: p.leads || 0,
      ca: Math.round(caByPartner.get(p.id) || 0),
    }))
    .sort((a, b) => b.bailleurs - a.bailleurs || b.ca - a.ca);

  const totals = {
    bailleurs: agencies.reduce((s, a) => s + a.bailleurs, 0),
    leads: agencies.reduce((s, a) => s + a.leads, 0),
    ca: agencies.reduce((s, a) => s + a.ca, 0),
    agences: agencies.length,
  };

  return NextResponse.json({
    network: network || { id: networkId, nom: networkId, statut: "pilote", brand_label: null, objectif: null },
    totals,
    agencies,
    objectif: network?.objectif ?? null,
  });
}
