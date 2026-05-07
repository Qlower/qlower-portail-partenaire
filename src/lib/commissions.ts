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
//   - + 10% sur le SURPLUS au-delà de l'objectif perso, si l'objectif perso
//     est atteint
//   - Ses 5% restent acquis dans tous les cas
//
// RUDO, JENNYFER, COLINE, ANATOLE, ELIAS, system_none : 0 €
// (Rudo : pas de commission pour le moment, Jennyfer = upsell hors barème,
//  Coline = support, anciens / sentinelle = pas concernés)
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

  // Aucune commission pour : Rudo, Jennyfer, Coline, anciens, sentinelle
  if (
    name === "rudolph" ||
    name === "rudo" ||
    name === "jennyfer" ||
    name === "support" ||
    input.commercialRole === "former" ||
    input.commercialRole === "support" ||
    input.commercialRole === "system_none" ||
    input.commercialRole === "upsell"
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

  // Règle Alex : 5% du CA HT toujours + 10% du surplus si obj perso atteint
  if (name === "alexandre" || input.commercialRole === "sales_admin") {
    const base = myCA_HT * 0.05;
    let bonus = 0;
    let breakdown = `5% × ${fmtEur(myCA_HT)} = ${fmtEur(base)}`;
    if (objReached && myCA_HT > myObj_HT) {
      const surplus = myCA_HT - myObj_HT;
      bonus = surplus * 0.10;
      breakdown += ` + 10% × surplus ${fmtEur(surplus)} = ${fmtEur(bonus)}`;
    }
    return {
      amount_eur: round2(base + bonus),
      rate_label: bonus > 0 ? "5% + 10% surplus" : "5%",
      ca_ht: myCA_HT,
      obj_reached: objReached,
      team_obj_reached: teamObjReached,
      rule_used: "alex_5plus10",
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
      breakdown: `10% × ${fmtEur(myCA_HT)} = ${fmtEur(c)} — obj équipe ${fmtEur(teamCA_HT)}/${fmtEur(teamObj_HT)} atteint`,
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
      breakdown: `5% × ${fmtEur(myCA_HT)} = ${fmtEur(c)} — obj perso ${fmtEur(myCA_HT)}/${fmtEur(myObj_HT)} atteint`,
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
    breakdown: `3% × ${fmtEur(myCA_HT)} = ${fmtEur(c)} — obj perso ${fmtEur(myCA_HT)}/${fmtEur(myObj_HT)}`,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtEur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}
