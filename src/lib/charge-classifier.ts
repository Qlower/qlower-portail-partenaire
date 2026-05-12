// Enrichissement automatique des charges Stripe au moment de l'ingestion :
//
//   - family       : catégorie produit (Abonnement / Déclaration fiscale / etc.)
//   - product_name : nom détaillé du produit (depuis Stripe invoice line items)
//   - newbiz_1m    : "NewBiz" si premier paiement du client depuis ≥ 1 mois
//   - newbiz_3m    : idem horizon 3 mois
//
// Logique utilisée par /api/webhooks/stripe à chaque charge captured.

import Stripe from "stripe";

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

export async function fetchProductInfo(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<{ product_name: string | null; family: string }> {
  const amount_eur = charge.amount / 100;
  const chargeWithInv = charge as ChargeWithInvoice;

  if (chargeWithInv.invoice && typeof chargeWithInv.invoice === "string") {
    try {
      const invoice = await stripe.invoices.retrieve(chargeWithInv.invoice, {
        expand: ["lines.data.price.product"],
      });
      const firstLine = invoice.lines.data[0] as unknown as InvoiceLineItemLegacy | undefined;
      if (firstLine) {
        const productRef = firstLine.price?.product;
        if (productRef && typeof productRef === "object" && "name" in productRef) {
          const name = (productRef as Stripe.Product).name || firstLine.description || null;
          return { product_name: name, family: inferFamily(name, amount_eur) };
        }
        if (firstLine.description) {
          return {
            product_name: firstLine.description,
            family: inferFamily(firstLine.description, amount_eur),
          };
        }
      }
    } catch (e) {
      console.warn("[charge-classifier] invoice fetch failed:", e instanceof Error ? e.message : e);
    }
  }

  const desc = charge.description || null;
  return { product_name: desc, family: inferFamily(desc, amount_eur) };
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
): Promise<{ newbiz_1m: "NewBiz" | "OldBiz"; newbiz_3m: "NewBiz" | "OldBiz" }> {
  const customerId =
    typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
  if (!customerId) return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz" };

  const chargeTs = charge.created;
  const ONE_MONTH_S = 30 * 24 * 3600;
  const THREE_MONTHS_S = 90 * 24 * 3600;

  try {
    const list = await stripe.charges.list({ customer: customerId, limit: 100 });
    const previous = list.data.filter(
      (c) => c.id !== charge.id && c.created < chargeTs && c.captured,
    );
    if (previous.length === 0) {
      // 1ère charge ever pour ce client
      return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz" };
    }
    const mostRecent = previous.reduce((max, c) => (c.created > max.created ? c : max));
    const sinceLast = chargeTs - mostRecent.created;
    return {
      newbiz_1m: sinceLast >= ONE_MONTH_S ? "NewBiz" : "OldBiz",
      newbiz_3m: sinceLast >= THREE_MONTHS_S ? "NewBiz" : "OldBiz",
    };
  } catch (e) {
    console.warn("[charge-classifier] previous charges fetch failed:", e instanceof Error ? e.message : e);
    return { newbiz_1m: "NewBiz", newbiz_3m: "NewBiz" };
  }
}

export async function enrichCharge(
  stripe: Stripe,
  charge: Stripe.Charge,
): Promise<ChargeEnrichment> {
  const [{ product_name, family }, { newbiz_1m, newbiz_3m }] = await Promise.all([
    fetchProductInfo(stripe, charge),
    inferNewBiz(stripe, charge),
  ]);
  return { family, product_name, newbiz_1m, newbiz_3m };
}
