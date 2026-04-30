import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

type HSContact = {
  id: string;
  properties: Record<string, string | null>;
};

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

export type ReconcileMatch = {
  id: string;
  email: string;
  name: string;
  source2: string;
  matchedUtm: string;
  partenaireLead: string;
  patched: boolean;
};

export type ReconcileReport = {
  mode: "applied" | "dry-run";
  scannedOrphans: number;
  matchedCount: number;
  ambiguousCount: number;
  activePartnersCount: number;
  inactivePartnersCount: number;
  knownUtms: Array<{ utm: string; nom: string; active: boolean }>;
  matched: ReconcileMatch[];
  ambiguous: Array<{ id: string; email: string; source2: string }>;
};

export async function reconcileAttribution(
  apply: boolean,
  daysBack = 90
): Promise<ReconcileReport | { error: string }> {
  const supabase = createServiceClient();
  const { data: partners } = await supabase
    .from("partners")
    .select("utm, code, nom, active");

  if (!partners || partners.length === 0) {
    return { error: "No partners" };
  }

  const utmIndex = new Map<string, { utm: string; nom: string; active: boolean }>();
  for (const p of partners) {
    if (!p.utm) continue;
    utmIndex.set(p.utm.toLowerCase(), { utm: p.utm, nom: p.nom, active: !!p.active });
  }

  const orphans = await fetchOrphanContacts(daysBack);

  const matched: ReconcileMatch[] = [];
  const ambiguous: { id: string; email: string; source2: string }[] = [];

  for (const c of orphans) {
    const src2 = (c.properties.hs_analytics_source_data_2 || "").toLowerCase();
    if (!src2) continue;

    const utmCandidate = src2.split(/\s*\/\s*/)[0]?.trim();
    if (!utmCandidate) continue;

    const hit = utmIndex.get(utmCandidate);
    if (!hit) {
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
    if (apply && hit.active) {
      patched = await patchContact(c.id, hit.utm);
    }

    matched.push({
      id: c.id,
      email: c.properties.email || "",
      name: `${c.properties.firstname || ""} ${c.properties.lastname || ""}`.trim(),
      source2: c.properties.hs_analytics_source_data_2 || "",
      matchedUtm: hit.utm,
      partenaireLead: hit.active ? hit.nom : `${hit.nom} [INACTIF]`,
      patched,
    });
  }

  return {
    mode: apply ? "applied" : "dry-run",
    scannedOrphans: orphans.length,
    matchedCount: matched.length,
    ambiguousCount: ambiguous.length,
    activePartnersCount: partners.filter((p) => p.active).length,
    inactivePartnersCount: partners.filter((p) => !p.active).length,
    knownUtms: Array.from(utmIndex.entries()).map(([k, v]) => ({
      utm: k,
      nom: v.nom,
      active: v.active,
    })),
    matched,
    ambiguous,
  };
}
