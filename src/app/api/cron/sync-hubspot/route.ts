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
    // Si le lead était marqué supprimé mais qu'on retombe dessus ici, c'est que
    // le contact existe bel et bien (on l'a dans le snapshot taggé) → c'était un
    // faux positif (tag retiré puis remis) : on lève le flag et on restaure
    // l'identité réelle depuis HubSpot.
    const wasDeleted = existing.hs_deleted === true;
    await supabase.from("leads").update({
      stage, hs_contact_id: contactId, commission_due: newCommissionDue,
      subscribed_at: subscribedAt,
      unsubscribed_at: unsubscribedAt,
      first_paid_at: firstPaidAt,
      nom, email,
      ...(wasDeleted ? { hs_deleted: false, hs_deleted_at: null } : {}),
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
async function fetchRecentContacts(full = false): Promise<{
  contacts: Array<{ id: string; properties: Record<string, string | null> }>;
  complete: boolean;
}> {
  const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
  const contacts: Array<{ id: string; properties: Record<string, string | null> }> = [];
  let after: string | undefined;
  let complete = true;

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

    // Un échec en cours de pagination = snapshot PARTIEL. On le signale pour
    // que la passe de suppression/détachement soit annulée (sinon des contacts
    // simplement non-récupérés passeraient pour "absents" → suppressions à tort).
    if (!res.ok) {
      complete = false;
      break;
    }
    const data = await res.json();
    for (const c of data.results || []) {
      contacts.push({ id: c.id, properties: c.properties });
    }
    after = data.paging?.next?.after;
  } while (after);

  return { contacts, complete };
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

// Vérifie qu'un contact HubSpot a RÉELLEMENT été supprimé (404 / archivé),
// par opposition à "il a juste perdu son tag partenaire__lead_". En cas de
// doute (erreur réseau / 5xx), on renvoie true (= existe) pour ne jamais
// anonymiser à tort.
async function hubspotContactExists(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/${id}`, {
      headers: { Authorization: `Bearer ${HS_TOKEN}` },
    });
    if (res.status === 404) return false;
    if (!res.ok) return true;
    const data = await res.json();
    return data?.archived !== true;
  } catch {
    return true;
  }
}

// Plafond de sécurité : si plus de N leads sont absents du snapshot, c'est
// quasi certainement un problème de récupération (pas N vraies suppressions).
// On annule alors toute la passe pour ne JAMAIS supprimer/anonymiser en masse.
const MAX_RECONCILE = 60;

// Réconcilie les leads présents en base mais absents du snapshot HubSpot taggé.
// Deux cas, qu'on distingue par un GET sur le contact :
//   1. Contact réellement supprimé de HubSpot (404/archivé) → anonymisation RGPD.
//   2. Contact existant mais sans tag partenaire → DÉTACHEMENT : on retire le
//      lead du compte affilié (lead + commission + compteurs), car l'attribution
//      a été retirée (souvent une correction d'erreur de tag).
// Seulement fiable en mode full ET snapshot complet (vérifié par l'appelant).
async function reconcileMissing(
  supabase: ReturnType<typeof createServiceClient>,
  hsIds: Set<string>
): Promise<{ anonymized: number; detached: number }> {
  const { data: supaLeads } = await supabase
    .from("leads")
    .select("id, hs_contact_id, partner_id, commission_due")
    .not("hs_contact_id", "is", null)
    .eq("hs_deleted", false);

  const candidates = (supaLeads || []).filter(
    (l) => l.hs_contact_id && !hsIds.has(l.hs_contact_id)
  );

  if (candidates.length > MAX_RECONCILE) {
    console.error(
      `[sync] ${candidates.length} leads absents du snapshot (> ${MAX_RECONCILE}) — passe de réconciliation ANNULÉE par sécurité`
    );
    return { anonymized: 0, detached: 0 };
  }

  let anonymized = 0;
  let detached = 0;
  for (const lead of candidates) {
    const stillExists = await hubspotContactExists(lead.hs_contact_id as string);
    if (stillExists) {
      // Tag retiré → détachement complet du compte affilié.
      await supabase.from("leads").delete().eq("id", lead.id);
      await supabase.rpc("decrement_partner_leads", { p_id: lead.partner_id });
      if (lead.commission_due) {
        await supabase.rpc("decrement_partner_abonnes", { p_id: lead.partner_id });
      }
      detached++;
    } else {
      // Contact réellement supprimé de HubSpot → anonymisation RGPD.
      try {
        await anonymizeDeletedLead(supabase, lead.id);
        anonymized++;
      } catch {
        // already logged inside anonymizeDeletedLead
      }
    }
  }
  return { anonymized, detached };
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
    const { contacts, complete } = await fetchRecentContacts(full);
    const supabase = createServiceClient();
    const results = {
      total: contacts.length,
      created: 0,
      updated: 0,
      transferred: 0,
      skipped: 0,
      deleted: 0,
      detached: 0,
      reconcile_skipped: false,
    };

    for (const contact of contacts) {
      const status = await upsertLead(supabase, contact.id, contact.properties);
      if (status === "created") results.created++;
      else if (status === "updated") results.updated++;
      else if (status.startsWith("transferred")) results.transferred++;
      else results.skipped++;
    }

    // Réconciliation (anonymisation RGPD + détachement) : fiable uniquement avec
    // un snapshot COMPLET (sinon on annule pour éviter des suppressions de masse).
    if (full && complete) {
      const hsIds = new Set(contacts.map((c) => c.id));
      const { anonymized, detached } = await reconcileMissing(supabase, hsIds);
      results.deleted = anonymized;
      results.detached = detached;
    } else if (full && !complete) {
      results.reconcile_skipped = true;
      console.error("[sync] snapshot HubSpot incomplet — passe de réconciliation (suppression/détachement) SKIPPÉE");
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
