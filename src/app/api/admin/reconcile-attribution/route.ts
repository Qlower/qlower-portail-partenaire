import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase-server";

// HubSpot pagination + tagging can take a while
export const maxDuration = 60;

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

type HSContact = {
  id: string;
  properties: Record<string, string | null>;
};

// Fetch contacts that have the analytics UTM source captured but no partner tag
async function fetchOrphanContacts(daysBack: number): Promise<HSContact[]> {
  const since = new Date(Date.now() - daysBack * 86400 * 1000).toISOString();
  const contacts: HSContact[] = [];
  let after: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            { propertyName: "hs_analytics_source_data_2", operator: "HAS_PROPERTY" },
            { propertyName: "partenaire__lead_", operator: "NOT_HAS_PROPERTY" },
            { propertyName: "createdate", operator: "GTE", value: since },
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "hs_analytics_source_data_1",
        "hs_analytics_source_data_2",
        "createdate",
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

async function patchContact(contactId: string, partenaireValue: string): Promise<boolean> {
  const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { partenaire__lead_: partenaireValue },
    }),
  });
  return res.ok;
}

type Match = {
  id: string;
  email: string;
  name: string;
  source2: string;
  matchedUtm: string;
  partenaireLead: string;
  patched: boolean;
};

async function reconcile(apply: boolean) {
  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("utm, code, nom")
    .eq("active", true);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ error: "No active partners" }, { status: 404 });
  }

  // Map utm (lowercased) → partenaire__lead_ enum value (= utm itself in our schema)
  const utmIndex = new Map<string, { utm: string; nom: string }>();
  for (const p of partners) {
    if (!p.utm) continue;
    utmIndex.set(p.utm.toLowerCase(), { utm: p.utm, nom: p.nom });
  }

  // Pull orphan contacts from the last 90 days. Older ones are tagged manually
  // by the team or via INTEGRATION sync — out of scope for auto-reconciliation.
  const orphans = await fetchOrphanContacts(90);

  const matched: Match[] = [];
  const ambiguous: { id: string; email: string; source2: string }[] = [];

  for (const c of orphans) {
    const src2 = (c.properties.hs_analytics_source_data_2 || "").toLowerCase();
    if (!src2) continue;

    // Format observed: "{utm_source} / {utm_medium}" — split on " / " or "/"
    const utmCandidate = src2.split(/\s*\/\s*/)[0]?.trim();
    if (!utmCandidate) continue;

    const hit = utmIndex.get(utmCandidate);
    if (!hit) {
      // Track candidates that look like an UTM but don't match any partner
      if (src2.includes("partenaire") || src2.includes("affiliation")) {
        ambiguous.push({
          id: c.id,
          email: c.properties.email || "",
          source2: c.properties.hs_analytics_source_data_2 || "",
        });
      }
      continue;
    }

    let patched = false;
    if (apply) {
      patched = await patchContact(c.id, hit.utm);
    }

    matched.push({
      id: c.id,
      email: c.properties.email || "",
      name: `${c.properties.firstname || ""} ${c.properties.lastname || ""}`.trim(),
      source2: c.properties.hs_analytics_source_data_2 || "",
      matchedUtm: hit.utm,
      partenaireLead: hit.nom,
      patched,
    });
  }

  return NextResponse.json({
    mode: apply ? "applied" : "dry-run",
    scannedOrphans: orphans.length,
    matchedCount: matched.length,
    ambiguousCount: ambiguous.length,
    matched,
    ambiguous,
  });
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  return reconcile(false);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if (auth.error) return auth.error;
  return reconcile(true);
}
