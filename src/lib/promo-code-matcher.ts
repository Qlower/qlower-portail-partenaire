// Rattachement automatique d'un client à un partenaire quand le client a utilisé
// un code promo correspondant au `partners.code`.
//
// Use case : un partenaire (CGP, agent immo...) recommande Qlower à un client à
// l'oral et lui donne juste son code promo. Le client signe sans cliquer sur un
// lien UTM, donc l'attribution HubSpot par `partenaire__lead_` ne se déclenche
// pas. Mais Stripe enregistre le code promo utilisé → on peut rattraper
// l'attribution depuis là.
//
// Le matching se fait sur charge → invoice → discounts → (promotion_code | coupon).
// On match d'abord le `promotion_code.code` (string customer-facing), puis le
// `coupon.id` si pas de promotion code.

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Type shims pour Stripe SDK v22 ─────────────────────────────────────────
// Le SDK v22 a retiré certains champs des types alors qu'ils existent toujours
// runtime (idem charge-classifier.ts pour `invoice`). On les remet via interfaces.
interface ChargeWithInvoice extends Stripe.Charge {
  invoice?: string | Stripe.Invoice | null;
}
interface DiscountWithCoupon extends Stripe.Discount {
  coupon?: string | Stripe.Coupon | null;
}

export interface PromoCodeMatch {
  partner_id: string;
  partner_utm: string;
  partner_code: string;
  matched_value: string;          // ce qui a matché en DB
  matched_via: "promotion_code" | "coupon_id";
  customer_email: string;
  customer_name: string | null;
  customer_phone: string | null;
}

/**
 * Récupère les codes promo (string) appliqués à une charge via son invoice.
 * Renvoie un array de candidats à matcher en DB.
 */
async function extractPromoCodesFromCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<Array<{ value: string; via: "promotion_code" | "coupon_id" }>> {
  // L'invoice peut être sur charge.invoice (string id) ou null pour les paiements one-shot
  const chargeWithInv = charge as ChargeWithInvoice;
  const invoiceId =
    typeof chargeWithInv.invoice === "string"
      ? chargeWithInv.invoice
      : chargeWithInv.invoice?.id;
  if (!invoiceId) return [];

  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(invoiceId, {
      // expand `discounts` pour avoir les détails directement
      expand: ["discounts", "discounts.promotion_code", "discounts.coupon"],
    });
  } catch {
    return [];
  }

  const candidates: Array<{ value: string; via: "promotion_code" | "coupon_id" }> = [];
  const discounts = (invoice.discounts || []) as Array<Stripe.Discount | string>;

  for (const d of discounts) {
    let discount: Stripe.Discount;
    if (typeof d === "string") {
      // Très rare : le discount est juste un id non expandé. On le retrieve.
      // Note : stripe.discounts.retrieve n'existe pas en SDK ; on a déjà demandé
      // l'expand donc ce cas n'arrive normalement pas. On l'ignore par sécurité.
      continue;
    } else {
      discount = d;
    }

    // 1) Promotion code (le plus courant : "JEAN10" → coupon)
    if (discount.promotion_code) {
      if (typeof discount.promotion_code === "string") {
        try {
          const pc = await stripe.promotionCodes.retrieve(discount.promotion_code);
          if (pc.code) candidates.push({ value: pc.code, via: "promotion_code" });
        } catch {
          /* ignore */
        }
      } else if ("code" in discount.promotion_code && discount.promotion_code.code) {
        candidates.push({ value: discount.promotion_code.code, via: "promotion_code" });
      }
    }

    // 2) Coupon id (cas où on a directement créé un Coupon avec id = code partenaire)
    const dwc = discount as DiscountWithCoupon;
    if (dwc.coupon) {
      const couponId = typeof dwc.coupon === "string" ? dwc.coupon : dwc.coupon.id;
      if (couponId) candidates.push({ value: couponId, via: "coupon_id" });
    }
  }

  return candidates;
}

/**
 * Match les codes extraits de la charge contre `partners.code` (case-insensitive).
 * Le premier partenaire trouvé gagne.
 */
export async function findPartnerByStripePromoCode(
  stripe: Stripe,
  charge: Stripe.Charge,
  supabase: SupabaseClient,
): Promise<PromoCodeMatch | null> {
  const candidates = await extractPromoCodesFromCharge(stripe, charge);
  if (candidates.length === 0) return null;

  // Email / nom / téléphone du client (utilisés pour créer/maj le lead)
  const customerEmail =
    charge.billing_details?.email || charge.receipt_email || "";
  let customerName = charge.billing_details?.name || null;
  let customerPhone = charge.billing_details?.phone || null;

  // Si rien dans billing_details, on retrieve le customer pour avoir nom/tel
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if ((!customerName || !customerPhone) && customerId) {
    try {
      const c = await stripe.customers.retrieve(customerId);
      if (!("deleted" in c) || c.deleted !== true) {
        const cust = c as Stripe.Customer;
        if (!customerName) customerName = cust.name || null;
        if (!customerPhone) customerPhone = cust.phone || null;
      }
    } catch {
      /* non bloquant */
    }
  }

  if (!customerEmail) return null;

  // Tente chaque candidat — case-insensitive sur partners.code
  for (const cand of candidates) {
    const { data: partner } = await supabase
      .from("partners")
      .select("id, code, utm, active")
      .ilike("code", cand.value)
      .maybeSingle();

    if (partner && partner.code) {
      return {
        partner_id: partner.id,
        partner_utm: partner.utm,
        partner_code: partner.code,
        matched_value: cand.value,
        matched_via: cand.via,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
      };
    }
  }

  return null;
}

/**
 * Crée (ou met à jour) le lead Supabase qui rattache ce client au partenaire
 * trouvé. Idempotent : si le lead existe déjà pour ce (partner_id, email), on ne
 * recrée pas. Si un lead existe pour cet email mais avec un AUTRE partner_id, on
 * NE TOUCHE PAS — l'attribution UTM/HubSpot existante est prioritaire.
 *
 * Renvoie le mode d'action effectué pour le reporting (created / updated / skipped).
 */
export async function attributeLeadFromPromoMatch(
  supabase: SupabaseClient,
  match: PromoCodeMatch,
  paymentDate: Date,
): Promise<{ action: "created" | "updated" | "skipped"; reason?: string; lead_id?: number }> {
  // Cherche un lead existant pour cet email (toutes partenaires confondus)
  const { data: anyLead } = await supabase
    .from("leads")
    .select("id, partner_id, stage, commission_due")
    .eq("email", match.customer_email)
    .maybeSingle();

  if (anyLead) {
    if (anyLead.partner_id !== match.partner_id) {
      return {
        action: "skipped",
        reason: `already_attributed_to:${anyLead.partner_id}`,
        lead_id: anyLead.id,
      };
    }
    // Même partenaire : on s'assure qu'il soit Payeur + commission_due
    const updates: Record<string, unknown> = {};
    if (anyLead.stage !== "Abonne") updates.stage = "Payeur";
    if (!anyLead.commission_due) updates.commission_due = true;
    if (Object.keys(updates).length > 0) {
      await supabase.from("leads").update(updates).eq("id", anyLead.id);
      return { action: "updated", lead_id: anyLead.id };
    }
    return { action: "skipped", reason: "lead_already_in_sync", lead_id: anyLead.id };
  }

  // Pas de lead → on en crée un avec source = "Promo"
  const nom = match.customer_name || match.customer_email.split("@")[0] || "Inconnu";
  const moisFr = paymentDate.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
  const { data: created, error } = await supabase
    .from("leads")
    .insert({
      partner_id: match.partner_id,
      nom,
      email: match.customer_email,
      source: "Promo",
      stage: "Payeur",
      mois: moisFr,
      biens: 0,
      hs_contact_id: null,
      commission_due: true,
    })
    .select("id")
    .single();

  if (error) {
    return { action: "skipped", reason: `insert_error:${error.message}` };
  }

  // Bump compteur partner.leads
  await supabase.rpc("increment_partner_leads", { p_id: match.partner_id }).then(() => {});

  return { action: "created", lead_id: created.id };
}

/**
 * En plus de créer le lead Supabase, on met à jour le contact HubSpot (`partenaire__lead_`)
 * pour que HubSpot reflète aussi l'attribution. Non bloquant : si HubSpot fail,
 * le lead Supabase reste valide.
 *
 * Skip si :
 *  - HUBSPOT_TOKEN absent
 *  - Contact pas trouvé dans HubSpot pour cet email
 *  - Le contact a déjà `partenaire__lead_` ≠ null (on ne suréscrit pas une
 *    attribution UTM existante)
 */
export async function syncPromoAttributionToHubSpot(match: PromoCodeMatch): Promise<{
  ok: boolean;
  hs_contact_id?: string;
  reason?: string;
}> {
  const HS_TOKEN = process.env.HUBSPOT_TOKEN;
  if (!HS_TOKEN) return { ok: false, reason: "no_hubspot_token" };

  const hsHeaders = {
    Authorization: `Bearer ${HS_TOKEN}`,
    "Content-Type": "application/json",
  };

  // 1) Cherche le contact par email
  try {
    const searchRes = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: hsHeaders,
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                { propertyName: "email", operator: "EQ", value: match.customer_email },
              ],
            },
          ],
          properties: ["email", "partenaire__lead_"],
          limit: 1,
        }),
      },
    );
    if (!searchRes.ok) return { ok: false, reason: `hs_search_failed:${searchRes.status}` };

    const searchData = (await searchRes.json()) as {
      results?: Array<{ id: string; properties: Record<string, string | null> }>;
    };
    const contact = searchData.results?.[0];
    if (!contact) return { ok: false, reason: "hs_contact_not_found" };

    const existingAttribution = contact.properties.partenaire__lead_;
    if (existingAttribution && existingAttribution.trim() !== "") {
      // Déjà attribué dans HubSpot → on ne suréscrit pas
      return {
        ok: false,
        hs_contact_id: contact.id,
        reason: `hs_already_attributed:${existingAttribution}`,
      };
    }

    // 2) Set partenaire__lead_ = partner.utm
    const updateRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`,
      {
        method: "PATCH",
        headers: hsHeaders,
        body: JSON.stringify({
          properties: {
            partenaire__lead_: match.partner_utm,
            // On garde une trace du moyen d'attribution pour audit
            utm_source: match.partner_utm,
          },
        }),
      },
    );

    if (!updateRes.ok) {
      return { ok: false, hs_contact_id: contact.id, reason: `hs_update_failed:${updateRes.status}` };
    }

    return { ok: true, hs_contact_id: contact.id };
  } catch (e) {
    return { ok: false, reason: `hs_error:${e instanceof Error ? e.message : "unknown"}` };
  }
}
