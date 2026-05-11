// Fetch live HubSpot engagement history for a given client (email + phone).
//
// Utilisé par le panel d'arbitrage /sales/admin/attribution → /sales/ventes :
// quand le manager (ou un négo) veut comprendre POURQUOI une attribution
// a été donnée à X, on déroule la chronologie : tous les calls Modjo,
// RDV, Aircall, notes, SMS sur cette personne — agrégés sur TOUTES les
// fiches HubSpot (cas Baptiste Perlin : 2 fiches pour la même personne).

import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

export type EngagementKind =
  | "modjo_closing"
  | "modjo_qualif"
  | "meeting_completed"
  | "meeting_scheduled"
  | "aircall_call"
  | "sms"
  | "note_sales"
  | "email";

export interface EngagementEntry {
  id: string;
  kind: EngagementKind;
  timestamp: string;       // ISO
  owner_id: string | null;
  owner_name: string;      // resolved depuis commercials
  owner_role: string;      // sales / sales_admin / former / unknown
  label: string;           // ex: "Modjo closing (3min)"
  excerpt: string;         // 200 premiers chars du contenu (texte brut)
  contact_id: string;      // de quelle fiche HubSpot ça vient (utile cas doublons)
  duration_ms?: number;
}

export interface EngagementHistory {
  contacts: Array<{ id: string; email: string | null; owner_id: string | null; owner_name: string }>;
  engagements: EngagementEntry[];
  /** Récap par owner — qui a touché ce client ces 90 derniers jours */
  by_owner: Array<{ owner_id: string; name: string; role: string; count: number; last_at: string }>;
}

interface CommercialLookup {
  id: string;
  name: string;
  role: string;
  hubspot_owner_id: string;
}

async function loadCommercials(): Promise<Map<string, CommercialLookup>> {
  const sb = createServiceClient();
  const { data } = await sb.from("commercials").select("id, name, role, hubspot_owner_id");
  const map = new Map<string, CommercialLookup>();
  for (const c of data || []) {
    if (c.hubspot_owner_id) {
      map.set(c.hubspot_owner_id, c as CommercialLookup);
    }
  }
  return map;
}

function resolveOwner(
  map: Map<string, CommercialLookup>,
  ownerId: string | null,
): { name: string; role: string } {
  if (!ownerId) return { name: "—", role: "unknown" };
  const c = map.get(ownerId);
  if (!c) return { name: `Owner ${ownerId.slice(0, 6)}`, role: "unknown" };
  return { name: c.name, role: c.role };
}

async function searchContacts(input: {
  email: string;
  phone?: string | null;
}): Promise<Array<{ id: string; email: string | null; owner_id: string | null }>> {
  const filterGroups: Array<{ filters: Array<{ propertyName: string; operator: string; value: string }> }> = [];
  if (input.email) {
    filterGroups.push({ filters: [{ propertyName: "email", operator: "EQ", value: input.email }] });
  }
  if (input.phone) {
    const last9 = input.phone.replace(/\D/g, "").slice(-9);
    if (last9.length >= 8) {
      filterGroups.push({ filters: [{ propertyName: "phone", operator: "CONTAINS_TOKEN", value: last9 }] });
      filterGroups.push({ filters: [{ propertyName: "mobilephone", operator: "CONTAINS_TOKEN", value: last9 }] });
    }
  }
  if (filterGroups.length === 0) return [];

  const resp = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups,
      properties: ["email", "phone", "mobilephone", "hubspot_owner_id"],
      limit: 10,
    }),
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as {
    results: Array<{ id: string; properties: Record<string, string | null> }>;
  };
  const seen = new Set<string>();
  const out: Array<{ id: string; email: string | null; owner_id: string | null }> = [];
  for (const c of data.results || []) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({
      id: c.id,
      email: c.properties.email,
      owner_id: c.properties.hubspot_owner_id || null,
    });
  }
  return out;
}

async function fetchEngagements(
  contactId: string,
  type: "notes" | "meetings" | "calls" | "communications" | "emails",
  properties: string[],
): Promise<Array<{ id: string; properties: Record<string, string | null> }>> {
  const assocResp = await fetch(
    `${HS_BASE}/crm/v4/objects/contacts/${contactId}/associations/${type}?limit=100`,
    { headers: { Authorization: `Bearer ${HS_TOKEN}` } },
  );
  if (!assocResp.ok) return [];
  const assocData = (await assocResp.json()) as { results?: Array<{ toObjectId: number }> };
  const ids = (assocData.results || []).map((a) => String(a.toObjectId));
  if (!ids.length) return [];

  const batchResp = await fetch(`${HS_BASE}/crm/v3/objects/${type}/batch/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties, inputs: ids.map((id) => ({ id })) }),
  });
  if (!batchResp.ok) return [];
  const batchData = (await batchResp.json()) as {
    results: Array<{ id: string; properties: Record<string, string | null> }>;
  };
  return batchData.results || [];
}

function isModjoNote(body: string | null | undefined): boolean {
  if (!body) return false;
  return /Participants/i.test(body) && /(Qlower|Conseiller|Contexte de l'appel)/i.test(body);
}

function detectClosing(body: string): boolean {
  const txt = body.replace(/<[^>]+>/g, " ").toLowerCase();
  const patterns = [
    /\bcarte (bancaire )?(enregistr|sauv|valid|saisie)/i,
    /\babonnement (pris|valid|sign|souscri|d[ée]marr)/i,
    /\bsouscription\b/i,
    /\bpaiement (effectu|valid|en cours|r[ée]ussi)/i,
    /\bcontrat (sign|valid)/i,
  ];
  return patterns.some((p) => p.test(txt));
}

function stripHtml(s: string, maxLen = 220): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export async function loadEngagementHistory(input: {
  email: string;
  phone?: string | null;
}): Promise<EngagementHistory> {
  const cmap = await loadCommercials();
  const contacts = await searchContacts(input);
  if (contacts.length === 0) {
    return { contacts: [], engagements: [], by_owner: [] };
  }

  const allEngagements: EngagementEntry[] = [];
  const seenIds = { notes: new Set<string>(), meetings: new Set<string>(), calls: new Set<string>(), comms: new Set<string>(), emails: new Set<string>() };

  // Fetch in parallel across all matched contacts
  await Promise.all(
    contacts.flatMap((contact) => [
      fetchEngagements(contact.id, "notes", ["hs_note_body", "hs_timestamp", "hs_createdate", "hubspot_owner_id"]).then((res) => {
        for (const n of res) {
          if (seenIds.notes.has(n.id)) continue;
          seenIds.notes.add(n.id);
          const p = n.properties;
          const ts = p.hs_timestamp || p.hs_createdate;
          if (!ts) continue;
          const body = p.hs_note_body || "";
          const ownerId = p.hubspot_owner_id || null;
          const owner = resolveOwner(cmap, ownerId);
          if (isModjoNote(body)) {
            const isClosing = detectClosing(body);
            allEngagements.push({
              id: `note:${n.id}`,
              kind: isClosing ? "modjo_closing" : "modjo_qualif",
              timestamp: ts,
              owner_id: ownerId,
              owner_name: owner.name,
              owner_role: owner.role,
              label: isClosing ? "Modjo closing" : "Modjo qualif",
              excerpt: stripHtml(body),
              contact_id: contact.id,
            });
          } else {
            allEngagements.push({
              id: `note:${n.id}`,
              kind: "note_sales",
              timestamp: ts,
              owner_id: ownerId,
              owner_name: owner.name,
              owner_role: owner.role,
              label: "Note interne",
              excerpt: stripHtml(body),
              contact_id: contact.id,
            });
          }
        }
      }),
      fetchEngagements(contact.id, "meetings", ["hs_meeting_title", "hs_meeting_outcome", "hs_meeting_start_time", "hs_meeting_body", "hubspot_owner_id"]).then((res) => {
        for (const m of res) {
          if (seenIds.meetings.has(m.id)) continue;
          seenIds.meetings.add(m.id);
          const p = m.properties;
          const ts = p.hs_meeting_start_time;
          if (!ts) continue;
          const outcome = (p.hs_meeting_outcome || "").toUpperCase();
          const ownerId = p.hubspot_owner_id || null;
          const owner = resolveOwner(cmap, ownerId);
          allEngagements.push({
            id: `meeting:${m.id}`,
            kind: outcome === "COMPLETED" ? "meeting_completed" : "meeting_scheduled",
            timestamp: ts,
            owner_id: ownerId,
            owner_name: owner.name,
            owner_role: owner.role,
            label: outcome === "COMPLETED" ? "RDV (terminé)" : `RDV (${outcome.toLowerCase() || "planifié"})`,
            excerpt: p.hs_meeting_title || stripHtml(p.hs_meeting_body || ""),
            contact_id: contact.id,
          });
        }
      }),
      fetchEngagements(contact.id, "calls", ["hs_call_body", "hs_call_duration", "hs_call_title", "hs_timestamp", "hubspot_owner_id"]).then((res) => {
        for (const ca of res) {
          if (seenIds.calls.has(ca.id)) continue;
          seenIds.calls.add(ca.id);
          const p = ca.properties;
          const ts = p.hs_timestamp;
          if (!ts) continue;
          const dur = parseInt(p.hs_call_duration || "0", 10);
          const ownerId = p.hubspot_owner_id || null;
          const owner = resolveOwner(cmap, ownerId);
          allEngagements.push({
            id: `call:${ca.id}`,
            kind: "aircall_call",
            timestamp: ts,
            owner_id: ownerId,
            owner_name: owner.name,
            owner_role: owner.role,
            label: dur ? `Aircall (${Math.round(dur / 1000)}s)` : "Aircall",
            excerpt: stripHtml(p.hs_call_body || p.hs_call_title || ""),
            contact_id: contact.id,
            duration_ms: dur || undefined,
          });
        }
      }),
      fetchEngagements(contact.id, "communications", ["hs_communication_body", "hs_communication_channel_type", "hs_timestamp", "hubspot_owner_id"])
        .catch(() => [] as Array<{ id: string; properties: Record<string, string | null> }>)
        .then((res) => {
          for (const sm of res) {
            if (seenIds.comms.has(sm.id)) continue;
            seenIds.comms.add(sm.id);
            const p = sm.properties;
            if ((p.hs_communication_channel_type || "").toUpperCase() !== "SMS") continue;
            const ts = p.hs_timestamp;
            if (!ts) continue;
            const ownerId = p.hubspot_owner_id || null;
            const owner = resolveOwner(cmap, ownerId);
            allEngagements.push({
              id: `sms:${sm.id}`,
              kind: "sms",
              timestamp: ts,
              owner_id: ownerId,
              owner_name: owner.name,
              owner_role: owner.role,
              label: "SMS",
              excerpt: stripHtml(p.hs_communication_body || ""),
              contact_id: contact.id,
            });
          }
        }),
    ]),
  );

  // Sort by timestamp desc
  allEngagements.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  // Recap per owner over the full history (helps see who's been active)
  const byOwnerMap = new Map<string, { name: string; role: string; count: number; last_at: string }>();
  for (const e of allEngagements) {
    if (!e.owner_id) continue;
    const cur = byOwnerMap.get(e.owner_id);
    if (!cur) {
      byOwnerMap.set(e.owner_id, { name: e.owner_name, role: e.owner_role, count: 1, last_at: e.timestamp });
    } else {
      cur.count++;
      if (e.timestamp > cur.last_at) cur.last_at = e.timestamp;
    }
  }
  const byOwner = [...byOwnerMap.entries()]
    .map(([owner_id, v]) => ({ owner_id, ...v }))
    .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));

  // Resolve owner name for each contact in metadata
  const contactsWithOwner = contacts.map((c) => {
    const o = resolveOwner(cmap, c.owner_id);
    return { ...c, owner_name: o.name };
  });

  return {
    contacts: contactsWithOwner,
    engagements: allEngagements,
    by_owner: byOwner,
  };
}
