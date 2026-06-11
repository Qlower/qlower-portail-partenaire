// Logique partagée de création/maj d'un lead Qlower à partir d'un contact HubSpot.
// Utilisée par :
//   - le webhook HubSpot (temps réel)
//   - le sync de réconciliation /api/admin/sync-partner-leads (rattrape les rates)
//
// Source de vérité = le tag HubSpot `partenaire__lead_`. Le matching partenaire
// est INSENSIBLE À LA CASSE (ilike) — corrige les cas "CocoonR" vs "cocoonr".

import { createServiceClient } from "@/lib/supabase-server";

type SB = ReturnType<typeof createServiceClient>;

// ── Map HubSpot lifecycle → stage Qlower ──
export function mapStage(props: Record<string, string | null>): "Abonne" | "Payeur" | "Non payeur" {
  const lc = (props.lifecyclestage || props.hs_lifecyclestage || "").toLowerCase();
  if (!lc) return "Non payeur";
  if (lc === "999998694") return "Abonne";
  if (["customer", "evangelist"].includes(lc)) return "Payeur";
  return "Non payeur";
}

// ── Upsert lead depuis un contact HubSpot ──
export async function upsertLeadFromContact(
  supabase: SB,
  contactId: string,
  props: Record<string, string | null>,
): Promise<{ status: string }> {
  // Normalise les UTM : underscore → tiret (corrige "boost_invest" vs "boost-invest",
  // "jamax_conseils" vs "jamax-conseils" — décalage de format des tags HubSpot).
  const partnerUtm = (props.partenaire__lead_ || props.utm_source || "").trim().replace(/_/g, "-");
  if (!partnerUtm) return { status: "skip:no_partner_utm" };

  // Partenaire par UTM — INSENSIBLE À LA CASSE (ilike, sans wildcard = égalité).
  const { data: partners } = await supabase
    .from("partners")
    .select("id")
    .ilike("utm", partnerUtm)
    .limit(1);
  const partner = partners?.[0];
  if (!partner) return { status: `skip:partner_not_found(${partnerUtm})` };

  const nom = [props.firstname, props.lastname].filter(Boolean).join(" ") || props.email || "Inconnu";
  const email = props.email || "";
  const stage = mapStage(props);
  const commissionDue = !!props.hs_v2_date_entered_999998694;

  // Transfert : ce contact était chez un AUTRE partenaire ?
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

  // Existe déjà chez le BON partenaire ? (match par hs_contact_id OU email)
  // .limit(1) (pas .maybeSingle) : si plusieurs lignes matchent — données
  // anormales, ex. 2 emails sous 1 hs_contact_id — on en prend une au lieu de
  // planter (ce qui re-créait des doublons à chaque run).
  const orFilter = email
    ? `hs_contact_id.eq.${contactId},email.eq.${email}`
    : `hs_contact_id.eq.${contactId}`;
  const { data: existingRows } = await supabase
    .from("leads")
    .select("id, stage, commission_due, hs_deleted")
    .eq("partner_id", partner.id)
    .or(orFilter)
    .order("id")
    .limit(1);
  const existing = existingRows?.[0];

  if (existing) {
    const newCommissionDue = existing.commission_due || commissionDue;
    const updateFields: Record<string, unknown> = {
      stage,
      hs_contact_id: contactId,
      commission_due: newCommissionDue,
    };
    // Auto-réparation : si le lead avait été marqué supprimé à tort (tag retiré
    // puis remis), on lève le flag et on restaure l'identité réelle.
    if (existing.hs_deleted) {
      updateFields.nom = nom;
      updateFields.email = email;
      updateFields.hs_deleted = false;
      updateFields.hs_deleted_at = null;
    }
    if (props.createdate) updateFields.created_at = new Date(props.createdate).toISOString();
    await supabase.from("leads").update(updateFields).eq("id", existing.id);
    if (!existing.commission_due && newCommissionDue) {
      await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
    }
    return { status: oldLead ? `transferred` : `updated` };
  }

  // Nouveau lead
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
  await supabase.rpc("increment_partner_leads", { p_id: partner.id });
  if (commissionDue) await supabase.rpc("increment_partner_abonnes", { p_id: partner.id });
  await supabase.from("partner_actions").insert({
    partner_id: partner.id,
    type: "contact" as const,
    label: `Nouveau lead UTM : ${nom} (${email})`,
    date: hsCreateDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
  });
  return { status: "created" };
}
