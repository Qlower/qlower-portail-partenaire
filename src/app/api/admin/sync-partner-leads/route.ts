// POST /api/admin/sync-partner-leads?token=...&after=<cursor>&dry=1
//
// Réconciliation HubSpot → table `leads`. Parcourt TOUS les contacts tagués
// `partenaire__lead_` dans HubSpot et crée/maj les leads manquants chez nous
// (rattrape les rates du webhook). Source de vérité = HubSpot.
//
//   dry=1  → prévisualisation (aucune écriture) : compte created / exists / skip
//   sinon  → applique réellement (crée les leads, incrémente les compteurs)
//
// Reprenable : repagine HubSpot via ?after=<cursor>, budget ~45s, renvoie
// { after, more } pour enchaîner les appels. Token-guardé.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { upsertLeadFromContact } from "@/lib/hubspot-leads";

export const maxDuration = 60;
export const runtime = "nodejs";

const TOKEN = "qlower-sync-partner-leads-2026";
const HS_TOKEN = process.env.HUBSPOT_TOKEN || "";
const HS_BASE = "https://api.hubapi.com";
const PROPS = [
  "firstname",
  "lastname",
  "email",
  "partenaire__lead_",
  "utm_source",
  "lifecyclestage",
  "hs_lifecyclestage",
  "hs_v2_date_entered_999998694",
  "createdate",
];

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!HS_TOKEN) return NextResponse.json({ error: "HUBSPOT_TOKEN manquant" }, { status: 503 });
  const dry = searchParams.get("dry") === "1";
  const sb = createServiceClient();

  let after = searchParams.get("after") || undefined;
  let processed = 0;
  let more = false;
  const byStatus: Record<string, number> = {};
  const bump = (k: string) => (byStatus[k] = (byStatus[k] || 0) + 1);
  const started = Date.now();

  while (true) {
    const resp = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: "partenaire__lead_", operator: "HAS_PROPERTY" }] },
        ],
        properties: PROPS,
        limit: 50,
        after,
      }),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `HubSpot ${resp.status}: ${(await resp.text()).slice(0, 200)}`, processed, byStatus },
        { status: 502 },
      );
    }
    const data = (await resp.json()) as {
      results?: Array<{ id: string; properties: Record<string, string | null> }>;
      paging?: { next?: { after?: string } };
    };
    const results = data.results || [];
    for (const c of results) {
      processed++;
      if (dry) {
        // Prévisualisation : résout le partenaire + vérifie l'existence, sans écrire.
        const utm = (c.properties.partenaire__lead_ || c.properties.utm_source || "").trim();
        if (!utm) {
          bump("skip:no_utm");
          continue;
        }
        const { data: pf } = await sb.from("partners").select("id").ilike("utm", utm).limit(1);
        const partner = pf?.[0];
        if (!partner) {
          bump(`skip:partner_not_found`);
          continue;
        }
        const email = c.properties.email || "";
        const { data: ex } = await sb
          .from("leads")
          .select("id")
          .eq("partner_id", partner.id)
          .or(`hs_contact_id.eq.${c.id},email.eq.${email}`)
          .maybeSingle();
        bump(ex ? "exists" : "would_create");
      } else {
        const { status } = await upsertLeadFromContact(sb, c.id, c.properties);
        bump(status.split(":")[0]);
      }
    }

    after = data.paging?.next?.after;
    if (!after) {
      more = false;
      break;
    }
    if (Date.now() - started > 30000) {
      more = true;
      break;
    }
  }

  return NextResponse.json({ dry, processed, byStatus, after: after || null, more });
}
