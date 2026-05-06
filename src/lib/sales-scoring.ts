// Server-side scoring logic for the internal sales attribution.
//
// Mirrors the logic of qlower-attribution-commerciale/scripts/lib/scoring.js
// (the offline tool) but operates against HubSpot live data + Supabase
// commercials table. Used by:
//   - the Stripe webhook (live re-scoring on charge.succeeded)
//   - the cron horaire (re-scoring of recent payments while analytics arrives)
//
// Returns the auto_commercial_id, auto_score, auto_source, auto_reason and
// last_efforts JSON to upsert into attribution_rows.

import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const POST_PAYMENT_TOLERANCE_HOURS = 1;
const LEGIT_WINDOW_DAYS = 90;
const MIN_AIRCALL_DURATION_MS = 20_000;

interface Signal {
  type: "modjo_closing" | "modjo_qualif" | "meeting_completed" | "aircall_call" | "sms" | "note_sales";
  weight: number;
  timestamp: string;
  owner_id: string;
  label: string;
  content: string;
}

interface Effort {
  name: string;
  type: string;
  date: string;
  days_before: number;
  owner_id: string;
}

export interface ScoringResult {
  owner_id: string | null;
  commercial_id: string | null;
  commercial_name: string;
  score: number;
  source: string;
  reason: string;
  last_efforts: Effort[];
}

interface CommercialMap {
  byOwnerId: Map<string, { id: string; name: string; role: string }>;
}

async function loadCommercials(): Promise<CommercialMap> {
  const sb = createServiceClient();
  const { data } = await sb.from("commercials").select("id, name, role, hubspot_owner_id");
  const byOwnerId = new Map<string, { id: string; name: string; role: string }>();
  for (const c of data || []) {
    byOwnerId.set(c.hubspot_owner_id, { id: c.id, name: c.name, role: c.role });
  }
  return { byOwnerId };
}

function commercialOf(map: CommercialMap, ownerId: string): { id: string | null; name: string; role: string } {
  const c = map.byOwnerId.get(ownerId);
  if (!c) return { id: null, name: `Inconnu(${ownerId})`, role: "unknown" };
  return { id: c.id, name: c.name, role: c.role };
}

interface ContactInfo {
  contactId: string;
  ownerId: string | null;
}

async function findContactByEmail(email: string): Promise<ContactInfo | null> {
  const resp = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "hubspot_owner_id"],
      limit: 1,
    }),
  });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { results: Array<{ id: string; properties: Record<string, string | null> }> };
  const c = data.results?.[0];
  if (!c) return null;
  return { contactId: c.id, ownerId: c.properties.hubspot_owner_id || null };
}

async function fetchEngagements(
  contactId: string,
  type: "notes" | "meetings" | "calls" | "communications",
  properties: string[],
): Promise<Array<{ id: string; properties: Record<string, string | null> }>> {
  // v4 list associations
  const assocResp = await fetch(`${HS_BASE}/crm/v4/objects/contacts/${contactId}/associations/${type}?limit=100`, {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
  });
  if (!assocResp.ok) return [];
  const assocData = (await assocResp.json()) as { results?: Array<{ toObjectId: number }> };
  const ids = (assocData.results || []).map((a) => String(a.toObjectId));
  if (!ids.length) return [];

  const batchResp = await fetch(`${HS_BASE}/crm/v3/objects/${type}/batch/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties,
      inputs: ids.map((id) => ({ id })),
    }),
  });
  if (!batchResp.ok) return [];
  const batchData = (await batchResp.json()) as { results: Array<{ id: string; properties: Record<string, string | null> }> };
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

function extractParticipantOwnerId(body: string, salesNames: string[]): string[] {
  // Modjo: <strong>Driss</strong> (Qlower)  OR  Driss : Conseiller chez Qlower
  const owners = new Set<string>();
  const reA = /<strong>([^<]+?)<\/strong>\s*\(\s*Qlower\s*\)/gi;
  let m;
  while ((m = reA.exec(body)) !== null) {
    const name = m[1].trim().toLowerCase();
    for (const sn of salesNames) {
      if (name.includes(sn.toLowerCase())) {
        owners.add(sn);
        break;
      }
    }
  }
  return [...owners];
}

function collectSignals(
  notes: Array<{ id: string; properties: Record<string, string | null> }>,
  meetings: Array<{ id: string; properties: Record<string, string | null> }>,
  calls: Array<{ id: string; properties: Record<string, string | null> }>,
  comms: Array<{ id: string; properties: Record<string, string | null> }>,
  cmap: CommercialMap,
): Signal[] {
  const signals: Signal[] = [];
  const salesNames = [...cmap.byOwnerId.values()]
    .filter((c) => c.role === "sales" || c.role === "upsell" || c.role === "sales_admin")
    .map((c) => c.name);

  for (const n of notes) {
    const p = n.properties;
    const ts = p.hs_timestamp || p.hs_createdate || "";
    if (!ts) continue;
    const body = p.hs_note_body || "";
    const ownerId = p.hubspot_owner_id || "";
    if (isModjoNote(body)) {
      const participantNames = extractParticipantOwnerId(body, salesNames);
      const targetOwnerId =
        participantNames.length > 0
          ? [...cmap.byOwnerId.entries()].find(([_, c]) => c.name === participantNames[participantNames.length - 1])?.[0] || ownerId
          : ownerId;
      const c = commercialOf(cmap, targetOwnerId);
      if (c.role !== "sales" && c.role !== "upsell" && c.role !== "sales_admin") continue;
      if (detectClosing(body)) {
        signals.push({ type: "modjo_closing", weight: 10, timestamp: ts, owner_id: targetOwnerId, label: "appel de closing", content: "" });
      } else {
        signals.push({ type: "modjo_qualif", weight: 8, timestamp: ts, owner_id: targetOwnerId, label: "appel Modjo", content: "" });
      }
    } else {
      const c = commercialOf(cmap, ownerId);
      if (c.role !== "sales" && c.role !== "upsell" && c.role !== "sales_admin") continue;
      signals.push({ type: "note_sales", weight: 4, timestamp: ts, owner_id: ownerId, label: "note interne", content: "" });
    }
  }

  for (const m of meetings) {
    const p = m.properties;
    const outcome = (p.hs_meeting_outcome || "").toUpperCase();
    if (outcome !== "COMPLETED") continue;
    const ts = p.hs_meeting_start_time;
    if (!ts) continue;
    const ownerId = p.hubspot_owner_id || "";
    const c = commercialOf(cmap, ownerId);
    if (c.role !== "sales" && c.role !== "upsell" && c.role !== "sales_admin") continue;
    signals.push({ type: "meeting_completed", weight: 7, timestamp: ts, owner_id: ownerId, label: "RDV démo", content: p.hs_meeting_title || "" });
  }

  for (const ca of calls) {
    const p = ca.properties;
    const ts = p.hs_timestamp;
    if (!ts) continue;
    const dur = parseInt(p.hs_call_duration || "0", 10);
    if (dur && dur < MIN_AIRCALL_DURATION_MS) continue;
    const ownerId = p.hubspot_owner_id || "";
    const c = commercialOf(cmap, ownerId);
    if (c.role === "former" || c.role === "unknown" || c.role === "support") continue;
    signals.push({ type: "aircall_call", weight: 6, timestamp: ts, owner_id: ownerId, label: dur ? `Aircall (${Math.round(dur / 1000)}s)` : "Aircall", content: "" });
  }

  for (const sm of comms) {
    const p = sm.properties;
    if ((p.hs_communication_channel_type || "").toUpperCase() !== "SMS") continue;
    const ts = p.hs_timestamp;
    if (!ts) continue;
    const ownerId = p.hubspot_owner_id || "";
    const c = commercialOf(cmap, ownerId);
    if (c.role !== "sales" && c.role !== "upsell" && c.role !== "sales_admin") continue;
    signals.push({ type: "sms", weight: 5, timestamp: ts, owner_id: ownerId, label: "SMS", content: "" });
  }

  return signals;
}

export async function scoreCharge({
  email,
  paymentDate,
}: {
  email: string;
  paymentDate: string;
}): Promise<ScoringResult> {
  const cmap = await loadCommercials();
  const contact = await findContactByEmail(email);
  if (!contact) {
    return {
      owner_id: null,
      commercial_id: null,
      commercial_name: "Non attribué",
      score: 0,
      source: "Aucun signal",
      reason: "Contact HubSpot introuvable",
      last_efforts: [],
    };
  }

  const [notes, meetings, calls, comms] = await Promise.all([
    fetchEngagements(contact.contactId, "notes", ["hs_note_body", "hs_timestamp", "hs_createdate", "hubspot_owner_id"]),
    fetchEngagements(contact.contactId, "meetings", ["hs_meeting_title", "hs_meeting_outcome", "hs_meeting_start_time", "hubspot_owner_id"]),
    fetchEngagements(contact.contactId, "calls", ["hs_call_body", "hs_call_duration", "hs_timestamp", "hubspot_owner_id"]),
    fetchEngagements(contact.contactId, "communications", ["hs_communication_channel_type", "hs_timestamp", "hubspot_owner_id"]).catch(() => []),
  ]);

  const signals = collectSignals(notes, meetings, calls, comms, cmap);
  const pd = new Date(paymentDate).getTime();
  const toleranceMs = POST_PAYMENT_TOLERANCE_HOURS * HOUR;

  // Build last_efforts (per-owner most recent pre-payment signal)
  const byOwner = new Map<string, Signal>();
  for (const s of signals) {
    const ts = new Date(s.timestamp).getTime();
    if (isNaN(ts) || ts - pd > toleranceMs) continue;
    const cur = byOwner.get(s.owner_id);
    if (!cur || ts > new Date(cur.timestamp).getTime()) byOwner.set(s.owner_id, s);
  }
  const lastEfforts: Effort[] = [...byOwner.values()]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((s) => {
      const c = commercialOf(cmap, s.owner_id);
      return {
        name: c.name,
        type: s.label,
        date: s.timestamp.slice(0, 10),
        days_before: Math.round((pd - new Date(s.timestamp).getTime()) / DAY),
        owner_id: s.owner_id,
      };
    });

  // Pick best signal
  let best: (Signal & { _days: number }) | null = null;
  for (const s of signals) {
    const ts = new Date(s.timestamp).getTime();
    if (isNaN(ts)) continue;
    const deltaMs = ts - pd;
    if (deltaMs > toleranceMs) continue;
    if (-deltaMs > LEGIT_WINDOW_DAYS * DAY) continue;
    const days = deltaMs / DAY;
    if (!best || s.weight > best.weight || (s.weight === best.weight && Math.abs(days) < Math.abs(best._days))) {
      best = { ...s, _days: days };
    }
  }

  if (best) {
    const c = commercialOf(cmap, best.owner_id);
    const absDays = Math.abs(best._days);
    let score = 6;
    if (best.type === "modjo_closing") score = absDays < 1 ? 10 : absDays <= 3 ? 9 : 8;
    else if (best.type === "modjo_qualif") score = absDays <= 7 ? 8 : 7;
    else if (best.type === "meeting_completed") score = absDays <= 7 ? 8 : 7;
    else if (best.type === "aircall_call") score = absDays <= 7 ? 7 : 6;
    return {
      owner_id: best.owner_id,
      commercial_id: c.id,
      commercial_name: c.name,
      score,
      source: best.type === "modjo_closing" ? "Modjo closing" : best.type === "modjo_qualif" ? "Modjo qualif" : best.type === "meeting_completed" ? "Meeting démo" : best.type === "aircall_call" ? "Aircall" : best.type === "sms" ? "SMS" : "Note",
      reason: `${c.name} — ${best.label} ${best._days >= 0 ? "J+" : "J-"}${Math.abs(Math.round(best._days))}`,
      last_efforts: lastEfforts,
    };
  }

  // No signal in window → fallback owner
  if (lastEfforts.length > 0) {
    const e = lastEfforts[0];
    return {
      owner_id: e.owner_id,
      commercial_id: cmap.byOwnerId.get(e.owner_id)?.id || null,
      commercial_name: e.name,
      score: 3,
      source: "Pas d'interaction 3 mois",
      reason: `Pas d'interaction 3 mois — Dernier effort : ${e.name} ${e.type} le ${e.date} (J-${e.days_before})`,
      last_efforts: lastEfforts,
    };
  }

  if (contact.ownerId) {
    const c = commercialOf(cmap, contact.ownerId);
    if (c.role === "sales" || c.role === "upsell" || c.role === "sales_admin") {
      return {
        owner_id: contact.ownerId,
        commercial_id: c.id,
        commercial_name: c.name,
        score: 4,
        source: "Owner sans interaction",
        reason: `${c.name} (owner contact) — aucun effort commercial trace`,
        last_efforts: [],
      };
    }
    if (c.role === "support") {
      return {
        owner_id: contact.ownerId,
        commercial_id: c.id,
        commercial_name: "Support",
        score: 2,
        source: "Support owner",
        reason: "Probable self-service (owner = Support)",
        last_efforts: [],
      };
    }
  }

  return {
    owner_id: null,
    commercial_id: null,
    commercial_name: "Non attribué",
    score: 0,
    source: "Aucun signal",
    reason: "Aucun signal commercial trouvé",
    last_efforts: [],
  };
}
