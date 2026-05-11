// Calcul des commissions sales — règles Qlower 2026.
//
// Règles hardcodées (à terme déplaçables vers une table commercials.commission_rules
// quand la UI #12 sera là). Source : décisions Alex de Blasi (BU Manager).
//
// HASAN, DRISS (sales) :
//   - 3% du CA HT généré      si objectif perso non atteint
//   - 5% du CA HT généré      si objectif perso atteint
//   - 10% du CA HT généré     si objectif équipe atteint
//
// ALEX (sales_admin) :
//   - 5% du CA HT toujours, sur tout son CA généré
//   - + 10% sur le DÉPASSEMENT de l'objectif ÉQUIPE (pas perso)
//   - Exemple : équipe fait 125k€, obj équipe 110k€ → bonus = 10% × 15k€
//     du dépassement = 1 500 €, plus ses 5% sur ses propres ventes
//
// JENNYFER (upsell) :
//   - 2% du CA HT généré (toujours)
//
// RUDO, COLINE, ANATOLE, ELIAS, support, former, system_none : 0 €
// (Rudo : pas de commission pour le moment, Coline = support, etc.)
//
// Périmètre : amount_net_eur en TTC → conversion HT en divisant par 1.20.

const VAT_RATE = 0.20;
export const HT_FACTOR = 1 / (1 + VAT_RATE); // 0.8333...

export interface CommissionInput {
  /** id du commercial (UUID) */
  commercialId: string;
  /** nom du commercial — pour matcher les règles hardcodées */
  commercialName: string;
  /** rôle du commercial */
  commercialRole: string;
  /** CA TTC du négo sur le mois (somme amount_net_eur des lignes attribuées à lui) */
  myCA_TTC: number;
  /** Objectif perso pour le mois (commercial_monthly_targets.target_eur) */
  myObj: number;
  /** CA TTC total équipe du mois (toutes lignes, y compris achats autonomes selon convention) */
  teamCA_TTC: number;
  /** Objectif équipe pour le mois */
  teamObj: number;
}

export interface CommissionResult {
  amount_eur: number;
  rate_label: string;       // ex: "5% (obj atteint)"
  ca_ht: number;            // CA HT du négo
  obj_reached: boolean;
  team_obj_reached: boolean;
  rule_used: string;        // identifiant de la règle appliquée
  breakdown?: string;       // détail textuel pour la transparence
}

export function computeCommission(input: CommissionInput): CommissionResult {
  const myCA_HT = input.myCA_TTC * HT_FACTOR;
  const myObj_HT = input.myObj > 0 ? input.myObj * HT_FACTOR : 0;
  const teamObj_HT = input.teamObj > 0 ? input.teamObj * HT_FACTOR : 0;
  const teamCA_HT = input.teamCA_TTC * HT_FACTOR;

  const objReached = myObj_HT > 0 && myCA_HT >= myObj_HT;
  const teamObjReached = teamObj_HT > 0 && teamCA_HT >= teamObj_HT;

  const name = input.commercialName.toLowerCase();

  // Aucune commission pour : Rudo, Coline, anciens, sentinelle
  if (
    name === "rudolph" ||
    name === "rudo" ||
    name === "support" ||
    input.commercialRole === "former" ||
    input.commercialRole === "support" ||
    input.commercialRole === "system_none"
  ) {
    return {
      amount_eur: 0,
      rate_label: "—",
      ca_ht: myCA_HT,
      obj_reached: objReached,
      team_obj_reached: teamObjReached,
      rule_used: "no_commission",
      breakdown: "Pas de commission au barème actuel.",
    };
  }

  // Règle Jennyfer / upsell : 2% du CA HT
  if (name === "jennyfer" || input.commercialRole === "upsell") {
    const c = myCA_HT * 0.02;
    return {
      amount_eur: round2(c),
      rate_label: "2% (upsell)",
      ca_ht: myCA_HT,
      obj_reached: objReached,
      team_obj_reached: teamObjReached,
      rule_used: "upsell_2",
      breakdown: `2% × ${fmtEurCents(myCA_HT)} = ${fmtEurCents(c)}`,
    };
  }

  // Règle Alex : 5% de son CA HT + 10% sur le DÉPASSEMENT ÉQUIPE
  if (name === "alexandre" || input.commercialRole === "sales_admin") {
    const base = myCA_HT * 0.05;
    let bonus = 0;
    let breakdown = `5% × ${fmtEurCents(myCA_HT)} = ${fmtEurCents(base)}`;
    if (teamObj_HT > 0 && teamCA_HT > teamObj_HT) {
      const teamSurplus = teamCA_HT - teamObj_HT;
      bonus = teamSurplus * 0.10;
      breakdown += `  +  10% × dépassement équipe ${fmtEurCents(teamSurplus)} = ${fmtEurCents(bonus)}`;
    } else if (teamObj_HT > 0) {
      breakdown += `  ·  équipe ${fmtEurCents(teamCA_HT)} / obj ${fmtEurCents(teamObj_HT)} (pas de dépassement → pas de bonus)`;
    }
    return {
      amount_eur: round2(base + bonus),
      rate_label: bonus > 0 ? "5% + 10% dépassement équipe" : "5%",
      ca_ht: myCA_HT,
      obj_reached: objReached,
      team_obj_reached: teamObjReached,
      rule_used: "alex_5plus10_team",
      breakdown,
    };
  }

  // Règle Hasan / Driss : 3% / 5% / 10%
  // 10% prend la priorité si l'obj équipe est atteint, peu importe le perso
  if (teamObjReached) {
    const c = myCA_HT * 0.10;
    return {
      amount_eur: round2(c),
      rate_label: "10% (obj équipe atteint)",
      ca_ht: myCA_HT,
      obj_reached: objReached,
      team_obj_reached: true,
      rule_used: "tiered_10",
      breakdown: `10% × ${fmtEurCents(myCA_HT)} = ${fmtEurCents(c)} — obj équipe ${fmtEurCents(teamCA_HT)}/${fmtEurCents(teamObj_HT)} atteint`,
    };
  }
  if (objReached) {
    const c = myCA_HT * 0.05;
    return {
      amount_eur: round2(c),
      rate_label: "5% (obj perso atteint)",
      ca_ht: myCA_HT,
      obj_reached: true,
      team_obj_reached: false,
      rule_used: "tiered_5",
      breakdown: `5% × ${fmtEurCents(myCA_HT)} = ${fmtEurCents(c)} — obj perso ${fmtEurCents(myCA_HT)}/${fmtEurCents(myObj_HT)} atteint`,
    };
  }
  const c = myCA_HT * 0.03;
  return {
    amount_eur: round2(c),
    rate_label: "3% (obj non atteint)",
    ca_ht: myCA_HT,
    obj_reached: false,
    team_obj_reached: false,
    rule_used: "tiered_3",
    breakdown: `3% × ${fmtEurCents(myCA_HT)} = ${fmtEurCents(c)} — obj perso ${fmtEurCents(myCA_HT)}/${fmtEurCents(myObj_HT)}`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Formate un montant en euros avec centimes (ex: "1 234,56 €").
 * Utilisé pour les commissions où la précision compte (paie réelle).
 */
export function fmtEurCents(n: number): string {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " €"
  );
}
