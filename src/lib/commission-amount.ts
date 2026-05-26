// Helper unique pour résoudre le "montant commissionnable" d'une ligne
// d'attribution_rows. Si `commissionable_amount_eur` est NULL → on prend
// `amount_net_eur` (comportement standard). Sinon on prend la valeur
// surchargée (ex: upsell où seul le delta doit être commissionné).
//
// Cette fonction DOIT être utilisée partout où on somme du CA pour calculer
// la commission d'un négo (speedometer, classement équipe, etc.). Le total
// affiché côté "CA brut" peut continuer à utiliser amount_net_eur pour
// rester aligné avec Stripe.

export interface CommissionableRow {
  amount_net_eur: number | null;
  commissionable_amount_eur: number | null;
}

/**
 * Renvoie le montant à commissionner pour cette ligne :
 *   - commissionable_amount_eur si renseigné (override admin)
 *   - sinon amount_net_eur
 *   - sinon 0
 */
export function getCommissionableAmount(row: CommissionableRow): number {
  const override = row.commissionable_amount_eur;
  if (override !== null && override !== undefined && !isNaN(Number(override))) {
    return Number(override);
  }
  return Number(row.amount_net_eur) || 0;
}

/**
 * Indique si la ligne a un override actif (utile pour afficher un badge).
 */
export function hasCommissionableOverride(row: CommissionableRow): boolean {
  return row.commissionable_amount_eur !== null && row.commissionable_amount_eur !== undefined;
}
