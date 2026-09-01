// Table de classification FAMILLE par ID produit Stripe (fiable), en
// remplacement de l'heuristique regex/montant (`inferFamily`) qui rangeait mal
// (ex. impossible de distinguer un abo d'un abo Laforêt, ou une TVA d'une décla).
//
// La `family` d'une charge est résolue dans cet ordre (cf. charge-classifier) :
//   1. produit Laforêt   → "Abo Laforet"  (cf. objective-scope, hors objectifs)
//   2. produit connu ici → la famille mappée
//   3. inconnu           → fallback regex/montant (inferFamily)
//
// Source des IDs/noms : catalogue Stripe Qlower (relevé 27/08/2026, validé Alex).

export const PRODUCT_FAMILY: Record<string, string> = {
  prod_P6P4ct2l0xBRSB: "Abonnement", // Abonnement fiscal autonome 2026
  prod_PDnOuW3A8yKvGD: "Complément abonnement", // Complément d'abonnement
  prod_S3Y2R1XJJTyzuK: "Abonnement Gold", // Abonnement fiscal gold 2026
  prod_V164qLnvHUjoDN: "Propriété supplémentaire", // Propriété supplémentaire 2026
  prod_PO2ken5pVgI6kQ: "Déclaration one shot", // Déclaration fiscale ... en autonomie
  prod_S3YFLJu8jLtHEW: "Déclaration one shot Gold", // Déclaration fiscale gold ...
  prod_PO1gkny67Ad1Ao: "Immatriculation", // Immatriculation LMNP
  prod_TSVraqCwMidgHo: "Correction déclaration", // Correction de déclaration fiscale
  prod_POmEYnY2dAMMQQ: "Déclaration TVA CA12", // Déclaration de TVA CA 12 : Annuel
  prod_SdTEpN89gsW4AB: "Bilan + plus-value", // Calcul de plus value et bilan de clôture - LMNP
  prod_TZdNAFwnVIuOs1: "Autre", // Option spécificité
};

// Famille mappée pour un ensemble d'ids produits (1er match gagne), ou null si
// aucun produit connu → le classifieur garde alors son fallback regex/montant.
export function familyForProductIds(ids: string[]): string | null {
  for (const id of ids) {
    if (PRODUCT_FAMILY[id]) return PRODUCT_FAMILY[id];
  }
  return null;
}

// Libellé produit PROPRE par ID Stripe — remplace le `product_name` brut
// (Stripe renvoie souvent "Subscription creation" ou vide sur les charges
// facturées). Labels courts et distincts, sans année pour regrouper les
// millésimes (abo 2026/2027 → même libellé).
export const PRODUCT_NAME_BY_ID: Record<string, string> = {
  prod_P6P4ct2l0xBRSB: "Abonnement fiscal",
  prod_S3Y2R1XJJTyzuK: "Abonnement fiscal Gold",
  prod_PDnOuW3A8yKvGD: "Complément d'abonnement",
  prod_V164qLnvHUjoDN: "Propriété supplémentaire",
  prod_PO2ken5pVgI6kQ: "Déclaration fiscale",
  prod_S3YFLJu8jLtHEW: "Déclaration fiscale Gold",
  prod_PO1gkny67Ad1Ao: "Immatriculation LMNP",
  prod_TSVraqCwMidgHo: "Correction de déclaration",
  prod_POmEYnY2dAMMQQ: "Déclaration TVA CA12",
  prod_SdTEpN89gsW4AB: "Bilan + plus-value LMNP",
  prod_TZdNAFwnVIuOs1: "Option spécificité",
};

// Libellé propre pour un ensemble d'ids produits (1er match gagne), ou null si
// inconnu → on garde alors le nom Stripe résolu / la description.
export function productNameForIds(ids: string[]): string | null {
  for (const id of ids) {
    if (PRODUCT_NAME_BY_ID[id]) return PRODUCT_NAME_BY_ID[id];
  }
  return null;
}
