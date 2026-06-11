// GET /api/cron/sync-partner-leads
//
// Auto-réparation quotidienne : réconcilie HubSpot → table `leads` pour les
// contacts tagués `partenaire__lead_` MODIFIÉS récemment (4 derniers jours).
// Rattrape les rates du webhook (tag posé après création, event manqué…) sans
// retraiter toute la base. Petit volume → tient dans une seule exécution.
//
// Déclenché par le cron Vercel (cf. vercel.json), auth via CRON_SECRET.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { upsertLeadFromContact } from "@/lib/hubspot-leads";

export const maxDuration = 60;
export const runtime = "nodejs";

const CRON_SECRET = process.env.CRON_SECRET || "";
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
  "hs_v2_date_exited_999998694",
  "date_premier_paiement_abonnement",
  "createdate",
];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!HS_TOKEN) return NextResponse.json({ error: "HUBSPOT_TOKEN manquant" }, { status: 503 });

  const sb = createServiceClient();
  const since = Date.now() - 4 * 24 * 3600 * 1000; // 4 derniers jours
  let after: string | undefined;
  let processed = 0;
  const byStatus: Record<string, number> = {};
  const bump = (k: string) => (byStatus[k] = (byStatus[k] || 0) + 1);
  const started = Date.now();

  while (true) {
    const resp = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              { propertyName: "partenaire__lead_", operator: "HAS_PROPERTY" },
              { propertyName: "lastmodifieddate", operator: "GTE", value: String(since) },
            ],
          },
        ],
        properties: PROPS,
        limit: 100,
        after,
      }),
    });
    if (!resp.ok) {
      return NextResponse.json(
        { error: `HubSpot ${resp.status}`, processed, byStatus },
        { status: 502 },
      );
    }
    const data = (await resp.json()) as {
      results?: Array<{ id: string; properties: Record<string, string | null> }>;
      paging?: { next?: { after?: string } };
    };
    for (const c of data.results || []) {
      processed++;
      const { status } = await upsertLeadFromContact(sb, c.id, c.properties);
      bump(status.split(":")[0]);
    }
    after = data.paging?.next?.after;
    if (!after || Date.now() - started > 45000) break;
  }

  return NextResponse.json({ window: "4d", processed, byStatus });
}
