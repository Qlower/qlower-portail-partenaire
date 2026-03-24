import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import crypto from "crypto";

const HS_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET || "";
const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

// ── Verify HubSpot signature ─────────────────────────────────
// v2: SHA-256(clientSecret + requestBody)
// v3: SHA-256(clientSecret + method + url + body) — only for public apps
function verifySignature(body: string, request: NextRequest): boolean {
  if (!HS_CLIENT_SECRET) return true; // no secret = skip verification

  // Try v3 first (x-hubspot-signature-v3)
  const sigV3 = request.headers.get("x-hubspot-signature-v3");
  if (sigV3) {
    const src = HS_CLIENT_SECRET + "POST" + request.url + body;
    return crypto.createHash("sha256").update(src).digest("hex") === sigV3;
  }

  // Try v2 (x-hubspot-signature)
  const sigV2 = request.headers.get("x-hubspot-signature");
  if (sigV2) {
    const src = HS_CLIENT_SECRET + body;
    return crypto.createHash("sha256").update(src).digest("hex") === sigV2;
  }

  // No signature header — allow in dev, reject in prod
  return process.env.NODE_ENV === "development";
}

// ── Fetch full contact from HubSpot ─────────────────────────
async function fetchContact(contactId: string) {
  const res = await fetch(
    `${HS_BASE}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,partenaire__lead_,utm_source,hs_lifecyclestage,lifecyclestage`,
    { headers: { Authorization: `Bearer ${HS_TOKEN}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Map HubSpot lifecycle to our stage ──────────────────────
// HubSpot lifecycle IDs from Qlower's CRM:
//   lead, marketingqualifiedlead, 1452450030 (SQL), opportunity, 1452450031 (non payeur)
//   customer (payeur non abonné), 999998694 (abonné), evangelist (promoteur), 1452451003 (churn)
function mapStage(props: Record<string, string | null>): "Abonne" | "Payeur" | "Non payeur" {
  const lc = (props.lifecyclestage || props.hs_lifecyclestage || "").toLowerCase();
  if (!lc) return "Non payeur";

  // Abonné
  if (lc === "999998694") return "Abonne";

  // Payeur (payeur non abonné + promoteur)
  if (["customer", "evangelist"].includes(lc)) return "Payeur";

  // Non payeur (lead, MQL, SQL, opportunity, user non payeur, churn)
  return "Non payeur";
}

// ── Upsert lead in Supabase ─────────────────────────────────
async function upsertLead(
  supabase: ReturnType<typeof createServiceClient>,
  contactId: string,
  props: Record<string, string | null>
) {
  const partnerUtm = props.partenaire__lead_ || props.utm_source || "";
  if (!partnerUtm) return { status: "skip:no_partner_utm" };

  // Find partner by UTM
  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("utm", partnerUtm)
    .single();

  if (!partner) return { status: `skip:partner_not_found(${partnerUtm})` };

  const nom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
  const email = props.email || "";
  const stage = mapStage(props);

  // Check if lead already exists
  const { data: existing } = await supabase
    .from("leads")
    .select("id, stage")
    .eq("partner_id", partner.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    // Update stage + hs_contact_id
    await supabase
      .from("leads")
      .update({ stage, hs_contact_id: contactId })
      .eq("id", existing.id);

    // If stage changed to Payeur, increment abonnes count
    if (existing.stage !== "Payeur" && stage === "Payeur") {
      await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
    }

    return { status: `updated:${existing.stage}->${stage}` };
  }

  // Insert new lead
  const now = new Date();
  const mois = now.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });

  await supabase.from("leads").insert({
    partner_id: partner.id,
    nom,
    email,
    source: "UTM",
    stage,
    mois,
    biens: 0,
    hs_contact_id: contactId,
  });

  // Increment partner lead count
  await supabase.rpc("increment_partner_leads", { p_id: partner.id });

  // Log action
  await supabase.from("partner_actions").insert({
    partner_id: partner.id,
    type: "contact" as const,
    label: `Nouveau lead UTM : ${nom} (${email})`,
    date: now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
  });

  return { status: "created" };
}

// ── POST handler — single URL for all HubSpot events ────────
// HubSpot sends: contact.creation, contact.propertyChange, etc.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify signature
  if (!verifySignature(rawBody, request)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: Array<Record<string, unknown>>;
  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: Array<{ contactId: string; event: string; status: string }> = [];

  for (const event of events) {
    const contactId = String(event.objectId || event.vid || "");
    const eventType = String(event.subscriptionType || "unknown");

    if (!contactId) continue;

    // Fetch full contact from HubSpot (works for both creation and property change)
    const contact = await fetchContact(contactId);
    if (!contact?.properties) {
      results.push({ contactId, event: eventType, status: "skip:no_data" });
      continue;
    }

    const result = await upsertLead(supabase, contactId, contact.properties);
    results.push({ contactId, event: eventType, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
