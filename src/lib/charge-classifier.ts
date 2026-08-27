// Enrichissement automatique des charges Stripe au moment de l'ingestion :
//
//   - family       : catégorie produit (Abonnement / Déclaration fiscale / etc.)
//   - product_name : nom détaillé du produit (depuis Stripe invoice line items)
//   - newbiz_1m    : "NewBiz" si premier paiement du client depuis ≥ 1 mois
//   - newbiz_3m    : idem horizon 3 mois
//
// Logique utilisée par /api/webhooks/stripe à chaque charge captured.

import Stripe from "stripe";
import { LAFORET_FAMILY, LAFORET_PRODUCT_IDS } from "@/lib/objective-scope";

// Patterns inférés depuis les données Avril 2026 (10 mois de signaux V1).
// Ordre = priorité : le 1er match gagne.
const FAMILY_PATTERNS: Array<{ family: string; match: RegExp }> = [
  { family: "Abonnement", match: /subscription|abonnement|monthly|annual/i },
  { family: "Immat / SIRET / INPI", match: /\b(siret|inpi|immat(ricul)?|kbis)\b/i },
  { family: "Correction décla", match: /\bcorrection|rectif/i },
  { family: "Déclaration fiscale", match: /d[ée]claration|liasse|fiscal|2031|2042|2044|2065/i },
];

/**
 * Devine la family d'une charge à partir de sa description et/ou de son montant.
 * Best-effort : si la description ne matche rien, fallback sur le montant.
 */
export function inferFamily(description: string | null, amount_eur: number): string {
  if (description) {
    for (const p of FAMILY_PATTERNS) {
      if (p.match.test(description)) return p.family;
    }
  }
  // Fallback par montant typique
  if (amount_eur >= 250 && amount_eur < 500) return "Déclaration fiscale";
  if (amount_eur >= 200 && amount_eur < 250) return "Abonnement";
  if (amount_eur < 100) return "Autre";
  return "Autre";
}

export interface ChargeEnrichment {
  family: string;
  product_name: string | null;
  newbiz_1m: "NewBiz" | "OldBiz";
  newbiz_3m: "NewBiz" | "OldBiz";
  // Statut du client au moment de la charge (best-effort via historique Stripe) :
  //   Conquête                      = aucune charge captured avant (1er achat ever)
  //   Conquête (1er paiement < 45j) = charge précédente < 45 j (client tout juste acquis qui réachète)
  //   Reconquête                    = charge précédente ≥ 45 j (client revenu après une pause)
  //   Inconnu                       = pas de customer / fetch échoué
  // NB : les reconductions d'abonnement ("Subscription update") ne passent PAS
  // ici — elles sont stockées à part dans subscription_renewals (non commissionnable).
  client_status: "Conquête" | "Conquête (1er paiement < 45j)" | "Reconquête" | "Inconnu";
}

/**
 * Récupère le nom de produit depuis l'invoice Stripe (si présente).
 * Fallback : charge.description.
 *
 * Note Stripe SDK v22 : les types TS de Charge n'exposent plus `invoice`
 * directement et la shape de InvoiceLineItem a évolué. On accède via
 * runtime cast (les champs existent côté API). On documente avec interface
 * locale pour rester lisible.
 */
interface ChargeWithInvoice extends Stripe.Charge {
  invoice?: string | null;
}
interface InvoiceLineItemLegacy {
  description?: string | null;
  price?: { product?: string | Stripe.Product };
  pricing?: { price_details?: { product?: string } };
}

// Extrait l'id produit Stripe d'une ligne de facture (plusieurs shapes selon
// la version du SDK / de l'API : price.product (string ou objet) ou
// pricing.price_details.product).
function productIdOfLine(line: InvoiceLineItemLegacy): string | null {
  const pr = line.price?.product;
  if (typeof pr === "string") return pr;
  if (pr && typeof pr === "object" && "id" in pr) return (pr as Stripe.Product).id || null;
  const pd = line.pricing?.price_details?.product;
  if (typeof pd === "string") return pd;
  return null;
}

export async function fetchProductInfo(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<{ product_name: string | null; family: string; product_ids: string[] }> {
  const amount_eur = charge.amount / 100;
  const chargeWithInv = charge as ChargeWithInvoice;
  let product_ids: string[] = [];
  let product_name: string | null = null;

  // ── Cas 1 : charge facturée (abonnement Stripe) → invoice.lines ──
  if (chargeWithInv.invoice && typeof chargeWithInv.invoice === "string") {
    try {
      const invoice = await stripe.invoices.retrieve(chargeWithInv.invoice, {
        expand: ["lines.data.price.product"],
      });
      const lines = (invoice.lines.data as unknown as InvoiceLineItemLegacy[]) || [];
      product_ids = lines.map(productIdOfLine).filter(Boolean) as string[];
      const firstLine = lines[0];
      if (firstLine) {
        const productRef = firstLine.price?.product;
        product_name =
          productRef && typeof productRef === "object" && "name" in productRef
            ? (productRef as Stripe.Product).name || firstLine.description || null
            : firstLine.description || null;
      }
    } catch (e) {
      console.warn("[charge-classifier] invoice fetch failed:", e instanceof Error ? e.message : e);
    }
  }

  // ── Cas 2 : paiement via Payment Link / Checkout (pas de facture) ──
  // Le produit vit sur les line items de la Checkout Session, retrouvée par
  // le payment_intent de la charge. C'est le cas des abo Laforêt (marque grise).
  if (product_ids.length === 0) {
    const pi =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (pi) {
      try {
        // Expand limité à 4 niveaux par Stripe → on s'arrête à `price`
        // (price.product est déjà présent sous forme d'id string, suffisant
        // pour la détection Laforet).
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: pi,
          limit: 1,
          expand: ["data.line_items.data.price"],
        });
        const sess = sessions.data[0] as unknown as { line_items?: { data?: InvoiceLineItemLegacy[] } } | undefined;
        const items = (sess?.line_items?.data || []) as InvoiceLineItemLegacy[];
        const ids = items.map(productIdOfLine).filter(Boolean) as string[];
        if (ids.length) product_ids = ids;
        if (!product_name && items[0]) {
          const pr = items[0].price?.product;
          product_name =
            pr && typeof pr === "object" && "name" in pr
              ? (pr as Stripe.Product).name || items[0].description || null
              : items[0].description || null;
        }
      } catch (e) {
        console.warn("[charge-classifier] checkout session lookup failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  if (!product_name) product_name = charge.description || null;
  return { product_name, family: inferFamily(product_name, amount_eur), product_ids };
}

/**
 * Détermine si une charge est "NewBiz" (premier paiement de ce client sur
 * l'horizon donné) ou "OldBiz" (récurrent).
 *
 * Méthode : recherche les charges précédentes captured pour ce customer_id
 * (max 100). Si aucune avant la charge actuelle → NewBiz partout.
 * Sinon : on regarde la date de la charge précédente la plus récente :
 *   - si > 30j avant la charge actuelle → NewBiz_1m
 *   - si > 90j avant → NewBiz_3m
 */
export async function inferNewBiz(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<{
  newbiz_1m: "NewBiz" | "OldBiz";
  newbiz_3m: "NewBiz" | "OldBiz";
  client_status: ChargeEnrichment["client_status"];
}> {
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz", client_status: "Inconnu" };

  const chargeTs = charge.created;
  const ONE_MONTH_S = 30 * 24 * 3600;
  const THREE_MONTHS_S = 90 * 24 * 3600;
  const RECONQUEST_S = 45 * 24 * 3600; // au-delà = client revenu après une pause

  try {
    const list = await stripe.charges.list({ customer: customerId, limit: 100 });
    const previous = list.data.filter(
      (c) => c.id !== charge.id && c.created < chargeTs && c.captured,
    );
    if (previous.length === 0) {
      // 1ère charge ever pour ce client → conquête
      return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz", client_status: "Conquête" };
    }
    const mostRecent = previous.reduce((max, c) => (c.created > max.created ? c : max));
    const sinceLast = chargeTs - mostRecent.created;
    return {
      newbiz_1m: sinceLast >= ONE_MONTH_S ? "NewBiz" : "OldBiz",
      newbiz_3m: sinceLast >= THREE_MONTHS_S ? "NewBiz" : "OldBiz",
      client_status: sinceLast >= RECONQUEST_S ? "Reconquête" : "Conquête (1er paiement < 45j)",
    };
  } catch (e) {
    console.warn("[charge-classifier] previous charges fetch failed:", e instanceof Error ? e.message : e);
    return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz", client_status: "Inconnu" };
  }
}

export async function enrichCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<ChargeEnrichment> {
  const [{ product_name, family, product_ids }, { newbiz_1m, newbiz_3m, client_status }] = await Promise.all([
    fetchProductInfo(stripe, charge),
    inferNewBiz(stripe, charge),
  ]);
  // Abo Laforêt (marque grise) → hors objectifs / hors commissions.
  // Détecté par l'id produit Stripe (fiable) ; on force la family qui sert
  // à la fois de label et de signal d'exclusion.
  const isLaforet = product_ids.some((id) => LAFORET_PRODUCT_IDS.has(id));
  return {
    family: isLaforet ? LAFORET_FAMILY : family,
    product_name,
    newbiz_1m,
    newbiz_3m,
    client_status,
  };
}
