// Périmètre des objectifs & commissions commerciaux (Tour de contrôle Sales).
//
// Certaines ventes NE DOIVENT PAS compter dans les objectifs ni être
// commissionnées — les commerciaux n'y sont pour rien. C'est le cas des
// abonnements en marque grise "Qlower pour Laforêt" : ils sont vendus par les
// agences Laforêt, pas par l'équipe sales Qlower.
//
// On les marque via la colonne existante `family = "Abo Laforet"` (pas de
// migration : le champ sert à la fois de LABEL — visible dans le Tour de
// contrôle — et de signal d'EXCLUSION lu par les agrégations objectifs/commissions).

export const LAFORET_FAMILY = "Abo Laforet";

// Produits Stripe des abonnements Laforêt (source : Alexandre, 08/2026).
// Toute charge dont une ligne de facture porte l'un de ces produits est
// classée `family = "Abo Laforet"` → hors objectifs, hors commissions.
export const LAFORET_PRODUCT_IDS = new Set<string>([
  "prod_UjBQDnHh6OnFZ2",
  "prod_UjBRPkE8DmdqNX",
  "prod_UjBRojbwkWLm9t",
  "prod_UjBSoTyj21rPbs",
  "prod_Ulm2pVFhbwPt0I",
  "prod_UsXbj66fm1n7C1", // produit payé par ZOUNON (ajouté 27/08/2026)
]);

// Vrai si la ligne est hors périmètre objectifs/commissions (ex. abo Laforet).
export function isExcludedFromObjectives(row: { family?: string | null }): boolean {
  return (row.family ?? "") === LAFORET_FAMILY;
}
