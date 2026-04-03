import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

const HS_TOKEN = process.env.HUBSPOT_TOKEN!;
const HS_BASE = "https://api.hubapi.com";

const PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "partenaire__lead_",
  "utm_source",
  "hs_lifecyclestage",
  "lifecyclestage",
  "hs_v2_date_entered_999998694",
  "createdate",
];

// ── Map HubSpot lifecycle to our stage (same as webhook) ────
function mapStage(
  props: Record<string, string | null>
): "Abonne" | "Payeur" | "Non payeur" {
  const lc = (
    props.lifecyclestage ||
    props.hs_lifecyclestage ||
    ""
  ).toLowerCase();
  if (!lc) return "Non payeur";

  // Abonne
  if (lc === "999998694") return "Abonne";

  // Payeur (payeur non abonne + promoteur)
  if (["customer", "evangelist"].includes(lc)) return "Payeur";

  // Non payeur (lead, MQL, SQL, opportunity, user non payeur, churn)
  return "Non payeur";
}

// ── Upsert a single lead (same logic as webhook) ───────────
async function upsertLead(
  supabase: ReturnType<typeof createServiceClient>,
  contactId: string,
  props: Record<string, string | null>
): Promise<{ status: "created" | "updated" | "skipped"; detail?: string }> {
  const partnerUtm = props.partenaire__lead_ || props.utm_source || "";
  if (!partnerUtm) return { status: "skipped", detail: "no_partner_utm" };

  // Find partner by UTM
  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("utm", partnerUtm)
    .single();

  if (!partner)
    return { status: "skipped", detail: `partner_not_found(${partnerUtm})` };

  const nom =
    [props.firstname, props.lastname].filter(Boolean).join(" ") ||
    props.email ||
    "Inconnu";
  const email = props.email || "";
  const stage = mapStage(props);
  const commissionDue = !!props.hs_v2_date_entered_999998694;

  // Check if lead already exists (upsert by email + partner_id)
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
    // Update created_at with HubSpot createdate if available
    if (props.createdate) {
      updateFields.created_at = new Date(props.createdate).toISOString();
    }

    await supabase
      .from("leads")
      .update(updateFields)
      .eq("id", existing.id);

    // Increment partner abonnes counter only when commission_due goes from false to true
    if (!existing.commission_due && newCommissionDue) {
      await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
    }

    return { status: "updated", detail: `${existing.stage}->${stage}` };
  }

  // Insert new lead
  const hsCreateDate = props.createdate ? new Date(props.createdate) : new Date();
  const mois = hsCreateDate.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });

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

  // Increment partner lead count (only for new leads)
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
    date: now.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  });

  return { status: "created" };
}

// ── Fetch all HubSpot contacts with partenaire__lead_ set ───
async function fetchAllPartnerContacts() {
  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "partenaire__lead_",
              operator: "HAS_PROPERTY",
            },
          ],
        },
      ],
      properties: PROPERTIES,
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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const results = data.results || [];

    for (const contact of results) {
      contacts.push({ id: contact.id, properties: contact.properties });
    }

    after = data.paging?.next?.after;
  } while (after);

  return contacts;
}

// ── POST handler ────────────────────────────────────────────
export async function POST() {
  try {
    const contacts = await fetchAllPartnerContacts();
    const supabase = createServiceClient();

    const summary = { synced: 0, updated: 0, skipped: 0, errors: 0, total: contacts.length };
    const errors: Array<{ contactId: string; error: string }> = [];

    for (const contact of contacts) {
      try {
        const result = await upsertLead(supabase, contact.id, contact.properties);

        if (result.status === "created") summary.synced++;
        else if (result.status === "updated") summary.updated++;
        else summary.skipped++;
      } catch (err) {
        summary.errors++;
        errors.push({
          contactId: contact.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Recount all partner leads/abonnes to fix any drift
    const { data: allPartners } = await supabase.from("partners").select("id");
    for (const p of allPartners || []) {
      const { count: leadCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("partner_id", p.id);
      const { count: abonnesCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("partner_id", p.id).eq("stage", "Abonne");
      await supabase.from("partners").update({ leads: leadCount || 0, abonnes: abonnesCount || 0 }).eq("id", p.id);
    }

    return NextResponse.json({ ...summary, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
