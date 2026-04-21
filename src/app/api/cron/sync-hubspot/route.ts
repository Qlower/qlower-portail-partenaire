import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";
const CRON_SECRET = process.env.CRON_SECRET || "";

const PROPERTIES = [
  "firstname", "lastname", "email", "phone",
  "partenaire__lead_", "utm_source",
  "hs_lifecyclestage", "lifecyclestage",
  "hs_v2_date_entered_999998694", "hs_v2_date_exited_999998694", "createdate",
  "date_premier_paiement_abonnement",
  "lastmodifieddate",
];

function mapStage(props: Record<string, string | null>): "Abonne" | "Payeur" | "Non payeur" {
  const lc = (props.lifecyclestage || props.hs_lifecyclestage || "").toLowerCase();
  if (!lc) return "Non payeur";
  if (lc === "999998694") return "Abonne";
  if (["customer", "evangelist"].includes(lc)) return "Payeur";
  return "Non payeur";
}

async function upsertLead(
  supabase: ReturnType<typeof createServiceClient>,
  contactId: string,
  props: Record<string, string | null>
): Promise<string> {
  const partnerUtm = props.partenaire__lead_ || props.utm_source || "";
  if (!partnerUtm) return "skip:no_utm";

  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("utm", partnerUtm)
    .single();

  if (!partner) return `skip:partner_not_found(${partnerUtm})`;

  const nom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
  const email = props.email || "";
  const stage = mapStage(props);
  const commissionDue = !!props.hs_v2_date_entered_999998694;

  // Transfer detection: contact moved to different partner
  const { data: oldLead } = await supabase
    .from("leads")
    .select("id, partner_id, commission_due")
    .eq("hs_contact_id", contactId)
    .neq("partner_id", partner.id)
    .maybeSingle();

  if (oldLead) {
    await supabase.from("leads").delete().eq("id", oldLead.id);
    await supabase.rpc("decrement_partner_leads", { p_id: oldLead.partner_id });
    if (oldLead.commission_due) {
      await supabase.rpc("decrement_partner_abonnes", { p_id: oldLead.partner_id });
    }
  }

  const { data: existing } = await supabase
    .from("leads")
    .select("id, stage, commission_due, hs_deleted")
    .eq("partner_id", partner.id)
    .eq("email", email)
    .maybeSingle();

  const subscribedAt = props.hs_v2_date_entered_999998694
    ? new Date(props.hs_v2_date_entered_999998694).toISOString()
    : null;
  const unsubscribedAt = props.hs_v2_date_exited_999998694
    ? new Date(props.hs_v2_date_exited_999998694).toISOString()
    : null;
  const firstPaidAt = props.date_premier_paiement_abonnement
    ? new Date(props.date_premier_paiement_abonnement).toISOString()
    : null;

  if (existing) {
    const newCommissionDue = existing.commission_due || commissionDue;
    // Do NOT overwrite name/email if the lead has been pseudonymized (RGPD erasure)
    const preserveIdentity = existing.hs_deleted === true;
    await supabase.from("leads").update({
      stage, hs_contact_id: contactId, commission_due: newCommissionDue,
      subscribed_at: subscribedAt,
      unsubscribed_at: unsubscribedAt,
      first_paid_at: firstPaidAt,
      ...(preserveIdentity ? {} : { nom, email }),
      ...(props.createdate ? { created_at: new Date(props.createdate).toISOString() } : {}),
    }).eq("id", existing.id);

    if (!existing.commission_due && newCommissionDue) {
      await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
    }
    return oldLead ? `transferred:${oldLead.partner_id}->${partner.id}` : "updated";
  }

  // New lead
  const hsCreateDate = props.createdate ? new Date(props.createdate) : new Date();
  await supabase.from("leads").insert({
    partner_id: partner.id, nom, email, source: "UTM", stage,
    mois: hsCreateDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" }),
    biens: 0, hs_contact_id: contactId, commission_due: commissionDue,
    created_at: hsCreateDate.toISOString(),
    subscribed_at: subscribedAt,
    unsubscribed_at: unsubscribedAt,
    first_paid_at: firstPaidAt,
  });

  await supabase.rpc("increment_partner_leads", { p_id: partner.id });
  if (commissionDue) {
    await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
  }

  return "created";
}

// Sync contacts modified in the last 26 hours (cron runs once per day around midnight Paris time)
// 24h + 2h safety margin to cover DST transitions and any missed run.
// If full=true, skip the date filter entirely (used to rattraper d'anciens decalages).
async function fetchRecentContacts(full = false) {
  const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  do {
    const filters: Array<Record<string, string>> = [
      { propertyName: "partenaire__lead_", operator: "HAS_PROPERTY" },
    ];
    if (!full) {
      filters.push({ propertyName: "lastmodifieddate", operator: "GTE", value: since });
    }
    const body: Record<string, unknown> = {
      filterGroups: [{ filters }],
      properties: PROPERTIES,
      limit: 100,
      ...(after ? { after } : {}),
    };

    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${HS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) break;
    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  return contacts;
}

// Anonymize a lead whose HubSpot contact no longer exists (RGPD erasure).
// Keeps 3 first chars of name + local-part of email + full domain.
// Erases phone. Flags hs_deleted=true.
async function anonymizeDeletedLead(
  supabase: ReturnType<typeof createServiceClient>,
  leadId: number
): Promise<void> {
  const { data: current } = await supabase
    .from("leads")
    .select("nom, email")
    .eq("id", leadId)
    .single();

  const nomTronque = current?.nom ? current.nom.slice(0, 3) + "…" : "Compte supprimé";
  let emailTronque: string | null = null;
  if (current?.email && current.email.includes("@")) {
    const [local, domain] = current.email.split("@");
    emailTronque = local.slice(0, 3) + "…@" + domain;
  }

  const { error } = await supabase
    .from("leads")
    .update({
      nom: nomTronque,
      email: emailTronque,
      hs_deleted: true,
      hs_deleted_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) {
    console.error(`Failed to anonymize lead ${leadId}:`, error.message);
    throw error;
  }
}

// Detect leads whose HubSpot contact was deleted: present in Supabase with a
// hs_contact_id, absent from the full HubSpot fetch. Only reliable in full mode.
async function detectDeletions(
  supabase: ReturnType<typeof createServiceClient>,
  hsIds: Set<string>
): Promise<number> {
  const { data: supaLeads } = await supabase
    .from("leads")
    .select("id, hs_contact_id")
    .not("hs_contact_id", "is", null)
    .eq("hs_deleted", false);

  let count = 0;
  for (const lead of supaLeads || []) {
    if (!lead.hs_contact_id) continue;
    if (hsIds.has(lead.hs_contact_id)) continue;
    try {
      await anonymizeDeletedLead(supabase, lead.id);
      count++;
    } catch {
      // already logged inside anonymizeDeletedLead
    }
  }
  return count;
}

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends Authorization: Bearer <CRON_SECRET>)
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const full = url.searchParams.get("full") === "true";
    const contacts = await fetchRecentContacts(full);
    const supabase = createServiceClient();
    const results = {
      total: contacts.length,
      created: 0,
      updated: 0,
      transferred: 0,
      skipped: 0,
      deleted: 0,
    };

    for (const contact of contacts) {
      const status = await upsertLead(supabase, contact.id, contact.properties);
      if (status === "created") results.created++;
      else if (status === "updated") results.updated++;
      else if (status.startsWith("transferred")) results.transferred++;
      else results.skipped++;
    }

    // Deletion detection only reliable when we have the complete HubSpot snapshot
    if (full) {
      const hsIds = new Set(contacts.map((c) => c.id));
      results.deleted = await detectDeletions(supabase, hsIds);
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
