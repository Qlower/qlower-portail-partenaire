import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

// ── Verify webhook authenticity ──────────────────────────────
// Uses a shared secret token in the URL: ?token=WEBHOOK_SECRET
// HubSpot signature verification is unreliable with Private Apps
// because the URL seen by Vercel differs from what HubSpot uses for signing.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

function verifyRequest(request: NextRequest): boolean {
  // If no secret configured, allow all (dev mode)
  if (!WEBHOOK_SECRET) return true;

  // Check ?token= query param
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  return token === WEBHOOK_SECRET;
}

// ── Fetch full contact from HubSpot ─────────────────────────
async function fetchContact(contactId: string) {
  const res = await fetch(
    `${HS_BASE}/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,partenaire__lead_,utm_source,hs_analytics_source_data_2,hs_lifecyclestage,lifecyclestage,hs_v2_date_entered_999998694,createdate`,
    { headers: { Authorization: `Bearer ${HS_TOKEN}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Auto-tag partenaire__lead_ from analytics UTM ───────────
// HubSpot stores captured UTMs in `hs_analytics_source_data_2` as
// `{utm_source} / {utm_medium}`. If the contact arrived via a partner
// link (page de presentation, RDV, etc.) but `partenaire__lead_` was
// never set (no per-partner workflow needed), we tag here.
async function autoTagFromAnalyticsUtm(
  supabase: ReturnType<typeof createServiceClient>,
  contactId: string,
  props: Record<string, string | null>
): Promise<string | null> {
  if (props.partenaire__lead_) return props.partenaire__lead_;
  const src2 = (props.hs_analytics_source_data_2 || "").trim();
  if (!src2) return null;

  // Format observed: "{utm_source} / {utm_medium}" or "{utm_source}/{utm_medium}"
  const utmCandidate = src2.split(/\s*\/\s*/)[0]?.trim().toLowerCase();
  if (!utmCandidate) return null;

  // Look up active partner by UTM (case-insensitive)
  const { data: partner } = await supabase
    .from("partners")
    .select("utm")
    .ilike("utm", utmCandidate)
    .eq("active", true)
    .maybeSingle();

  if (!partner?.utm) return null;

  // Patch the contact in HubSpot so subsequent flows see the tag
  const patchRes = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${contactId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${HS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: { partenaire__lead_: partner.utm } }),
  });
  if (!patchRes.ok) return null;

  // Reflect in current props so upsertLead continues without re-fetching
  props.partenaire__lead_ = partner.utm;
  return partner.utm;
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
  // Commission due if contact has ever entered the "User abonné" lifecycle stage (hs_v2_date_entered_999998694)
  // This date is set by HubSpot on first entry and never reset, even after churn + re-subscription
  const commissionDue = !!props.hs_v2_date_entered_999998694;

  // Check if this contact exists under a DIFFERENT partner (transfer case)
  const { data: oldLead } = await supabase
    .from("leads")
    .select("id, partner_id, commission_due")
    .eq("hs_contact_id", contactId)
    .neq("partner_id", partner.id)
    .maybeSingle();

  if (oldLead) {
    // Remove from old partner and fix their counters
    await supabase.from("leads").delete().eq("id", oldLead.id);
    await supabase.rpc("decrement_partner_leads", { p_id: oldLead.partner_id });
    if (oldLead.commission_due) {
      await supabase.rpc("decrement_partner_abonnes", { p_id: oldLead.partner_id });
    }
  }

  // Check if lead already exists under the CORRECT partner
  const { data: existing } = await supabase
    .from("leads")
    .select("id, stage, commission_due")
    .eq("partner_id", partner.id)
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const newCommissionDue = existing.commission_due || commissionDue;

    const updateFields: Record<string, unknown> = {
      stage,
      hs_contact_id: contactId,
      commission_due: newCommissionDue,
    };
    if (props.createdate) {
      updateFields.created_at = new Date(props.createdate).toISOString();
    }

    await supabase
      .from("leads")
      .update(updateFields)
      .eq("id", existing.id);

    // Increment partner abonnes counter only when commission_due goes from false to true (first time)
    if (!existing.commission_due && newCommissionDue) {
      await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
    }

    return { status: oldLead ? `transferred:${oldLead.partner_id}->${partner.id}` : `updated:${existing.stage}->${stage}` };
  }

  // Insert new lead
  const hsCreateDate = props.createdate ? new Date(props.createdate) : new Date();
  const mois = hsCreateDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });

  await supabase.from("leads").insert({
    partner_id: partner.id,
    nom,
    email,
    source: "UTM",
    stage,
    mois,
    biens: 0,
    hs_contact_id: contactId,
    commission_due: commissionDue,
    created_at: hsCreateDate.toISOString(),
  });

  // Increment partner lead count
  await supabase.rpc("increment_partner_leads", { p_id: partner.id });

  // Also increment abonnes if new lead has commission_due
  if (commissionDue) {
    await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
  }

  // Log action
  await supabase.from("partner_actions").insert({
    partner_id: partner.id,
    type: "contact" as const,
    label: `Nouveau lead UTM : ${nom} (${email})`,
    date: hsCreateDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
  });

  return { status: "created" };
}

// ── POST handler — single URL for all HubSpot events ────────
// HubSpot sends: contact.creation, contact.propertyChange, etc.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify request authenticity
  if (!verifyRequest(request)) {
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

    // Defensive auto-tag: if partenaire__lead_ is empty but the captured
    // UTM matches an active partner, tag it now (no per-partner workflow needed).
    await autoTagFromAnalyticsUtm(supabase, contactId, contact.properties);

    const result = await upsertLead(supabase, contactId, contact.properties);
    results.push({ contactId, event: eventType, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
