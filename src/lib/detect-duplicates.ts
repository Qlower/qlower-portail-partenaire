// Détection proactive de doublons HubSpot.
//
// Algo simple en 2 passes :
//   1) Scan paginé des contacts HubSpot créés ces N jours
//   2) Groupage par phone normalisé (last 9 digits) + par nom normalisé
//      (lowercase, sans accent, sans espaces)
//
// Tout groupe de 2+ contacts qui partage un même phone OU un même nom
// normalisé est inséré dans hubspot_duplicates. Idempotent : on dédoublonne
// par (match_signal, match_value) sur upsert.

import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

interface HsContact {
  id: string;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  phone: string | null;
  mobilephone: string | null;
  owner_id: string | null;
  createdate: string | null;
}

export interface DuplicateGroup {
  match_signal: "phone_last9" | "name_normalized";
  match_value: string;
  contact_ids: string[];
  contact_emails: (string | null)[];
  contact_names: string[];
  contact_owners: (string | null)[];
  score: number;
}

export interface DetectReport {
  scanned: number;
  pages: number;
  groups_found: number;
  groups_inserted: number;
  groups_existing: number;
  duration_ms: number;
}

function normalisePhone(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length < 9) return null;
  return d.slice(-9);
}

function normaliseName(first: string | null, last: string | null): string | null {
  const full = [first, last].filter(Boolean).join(" ").trim();
  if (!full) return null;
  const n = full
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (n.length < 4) return null;
  return n;
}

async function fetchContactsPage(after: string | undefined): Promise<{
  results: HsContact[];
  next: string | undefined;
}> {
  const url = new URL(`${HS_BASE}/crm/v3/objects/contacts`);
  url.searchParams.set("limit", "100");
  url.searchParams.set(
    "properties",
    ["email", "firstname", "lastname", "phone", "mobilephone", "hubspot_owner_id", "createdate"].join(","),
  );
  if (after) url.searchParams.set("after", after);

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${HS_TOKEN}` },
  });
  if (!resp.ok) {
    throw new Error(`HubSpot list contacts failed: ${resp.status} ${await resp.text().catch(() => "")}`);
  }
  const data = (await resp.json()) as {
    results: Array<{ id: string; properties: Record<string, string | null> }>;
    paging?: { next?: { after: string } };
  };
  return {
    results: (data.results || []).map((c) => ({
      id: c.id,
      email: c.properties.email,
      firstname: c.properties.firstname,
      lastname: c.properties.lastname,
      phone: c.properties.phone,
      mobilephone: c.properties.mobilephone,
      owner_id: c.properties.hubspot_owner_id,
      createdate: c.properties.createdate,
    })),
    next: data.paging?.next?.after,
  };
}

export async function detectDuplicates(options: {
  /** Limite de contacts à scanner (sécurité contre rate-limit HubSpot). Défaut 800. */
  maxContacts?: number;
  /** Scanner uniquement les contacts créés ces N jours. Défaut 180 (6 mois). */
  windowDays?: number;
  /** Budget temps avant d'arrêter le scan et de grouper ce qu'on a (ms). Défaut 45000. */
  timeBudgetMs?: number;
}): Promise<DetectReport & { timed_out: boolean; scanned_contacts: number }> {
  const start = Date.now();
  const maxContacts = options.maxContacts ?? 800;
  const windowDays = options.windowDays ?? 180;
  const timeBudgetMs = options.timeBudgetMs ?? 45_000;
  const minCreatedAt = new Date(Date.now() - windowDays * 24 * 3600 * 1000).getTime();

  const sb = createServiceClient();

  // 1) Scan paginé — break si on dépasse le budget temps (Vercel timeout 60s)
  const contacts: HsContact[] = [];
  let after: string | undefined;
  let pages = 0;
  let timedOut = false;
  while (contacts.length < maxContacts) {
    if (Date.now() - start > timeBudgetMs) {
      timedOut = true;
      break;
    }
    const page = await fetchContactsPage(after);
    pages++;
    for (const c of page.results) {
      if (c.createdate && new Date(c.createdate).getTime() < minCreatedAt) continue;
      contacts.push(c);
      if (contacts.length >= maxContacts) break;
    }
    if (!page.next) break;
    after = page.next;
  }

  // 2) Groupage
  type Bucket = { contacts: HsContact[]; match_value: string };
  const byPhone = new Map<string, Bucket>();
  const byName = new Map<string, Bucket>();

  for (const c of contacts) {
    const phoneKey = normalisePhone(c.phone) || normalisePhone(c.mobilephone);
    if (phoneKey) {
      const b = byPhone.get(phoneKey) || { contacts: [], match_value: phoneKey };
      b.contacts.push(c);
      byPhone.set(phoneKey, b);
    }
    const nameKey = normaliseName(c.firstname, c.lastname);
    if (nameKey) {
      const b = byName.get(nameKey) || { contacts: [], match_value: nameKey };
      b.contacts.push(c);
      byName.set(nameKey, b);
    }
  }

  // Build duplicate groups (only buckets with 2+ contacts)
  const groups: DuplicateGroup[] = [];
  for (const b of byPhone.values()) {
    if (b.contacts.length < 2) continue;
    // Ne pas créer de "doublon" si tous les contacts partagent le même email
    // (auquel cas HubSpot les aurait déjà fusionnés). Filtrer.
    const emails = new Set(b.contacts.map((c) => (c.email || "").toLowerCase()).filter(Boolean));
    if (emails.size <= 1 && b.contacts.every((c) => c.email)) continue;
    groups.push({
      match_signal: "phone_last9",
      match_value: b.match_value,
      contact_ids: b.contacts.map((c) => c.id),
      contact_emails: b.contacts.map((c) => c.email),
      contact_names: b.contacts.map((c) => [c.firstname, c.lastname].filter(Boolean).join(" ") || "—"),
      contact_owners: b.contacts.map((c) => c.owner_id),
      score: 90, // Phone match = high confidence
    });
  }
  for (const b of byName.values()) {
    if (b.contacts.length < 2) continue;
    // Skip if already captured via phone (same contact ids)
    const sortedIds = [...b.contacts.map((c) => c.id)].sort().join(",");
    const alreadyByPhone = groups.some(
      (g) => g.match_signal === "phone_last9" && [...g.contact_ids].sort().join(",") === sortedIds,
    );
    if (alreadyByPhone) continue;
    groups.push({
      match_signal: "name_normalized",
      match_value: b.match_value,
      contact_ids: b.contacts.map((c) => c.id),
      contact_emails: b.contacts.map((c) => c.email),
      contact_names: b.contacts.map((c) => [c.firstname, c.lastname].filter(Boolean).join(" ") || "—"),
      contact_owners: b.contacts.map((c) => c.owner_id),
      score: 55, // Name match = medium confidence (homonymes possibles)
    });
  }

  // 3) Upsert dans hubspot_duplicates — on évite les doublons sur (signal, value)
  let inserted = 0;
  let existing = 0;
  for (const g of groups) {
    const { data: existingRow } = await sb
      .from("hubspot_duplicates")
      .select("id, resolved, contact_ids")
      .eq("match_signal", g.match_signal)
      .eq("match_value", g.match_value)
      .maybeSingle();
    if (existingRow) {
      // Si la ligne existante est résolue ET les contact_ids n'ont pas changé,
      // ne rien faire. Sinon, créer une nouvelle entrée (= nouveau doublon détecté
      // ou ajout de contact à un groupe déjà connu).
      const sameSet =
        [...existingRow.contact_ids].sort().join(",") === [...g.contact_ids].sort().join(",");
      if (sameSet) {
        existing++;
        continue;
      }
      // Insert une nouvelle ligne (le groupe a évolué)
    }
    const { error } = await sb.from("hubspot_duplicates").insert({
      match_signal: g.match_signal,
      match_value: g.match_value,
      contact_ids: g.contact_ids,
      contact_emails: g.contact_emails,
      contact_names: g.contact_names,
      contact_owners: g.contact_owners,
      score: g.score,
    });
    if (!error) inserted++;
  }

  return {
    scanned: contacts.length,
    pages,
    groups_found: groups.length,
    groups_inserted: inserted,
    groups_existing: existing,
    duration_ms: Date.now() - start,
    timed_out: timedOut,
    scanned_contacts: contacts.length,
  };
}
