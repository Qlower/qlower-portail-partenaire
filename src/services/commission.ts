import type { CommissionRule, CommissionResult, Tranche } from "@/types";

export const COMM_LABELS: Record<string, string> = {
  souscription: "Fixe à la souscription",
  annuelle: "Fixe annuelle",
  biens: "Variable selon nb de biens",
  pct_ca: "% du CA généré",
};

/**
 * Formats a commission amount with the right tax suffix.
 * @param amount montant
 * @param ht true if amounts are stored as Hors Taxes
 */
export function formatCommission(amount: number, ht?: boolean): string {
  return `${amount.toLocaleString("fr-FR")} € ${ht ? "HT" : "TTC"}`;
}

export function commissionSuffix(ht?: boolean): string {
  return ht ? "HT" : "TTC";
}

export const DEFAULT_TRANCHES = (): Tranche[] => [
  { max: 1, montant: 50 },
  { max: 3, montant: 80 },
  { max: 99, montant: 120 },
];

export function calcCommission(
  rules: CommissionRule[] = [],
  abonnes = 0,
  biensMoyens = 2,
  caParClient = 300
): CommissionResult {
  let total = 0;
  const detail: CommissionResult["detail"] = [];

  for (const r of rules) {
    if (!r.actif) continue;

    if (r.type === "souscription" && r.montant) {
      const m = r.montant * abonnes;
      total += m;
      detail.push({ label: "Souscription", calc: `${abonnes}×${r.montant}€`, montant: m });
    }

    if (r.type === "annuelle" && r.montant) {
      const m = r.montant * abonnes;
      total += m;
      detail.push({ label: "Annuelle", calc: `${abonnes}×${r.montant}€`, montant: m });
    }

    if (r.type === "biens") {
      const tranches = r.tranches || DEFAULT_TRANCHES();
      const tr = tranches.find((x) => biensMoyens <= x.max) || tranches[tranches.length - 1];
      const m = tr.montant * abonnes;
      total += m;
      detail.push({ label: "Variable biens", calc: `${abonnes}×${tr.montant}€`, montant: m });
    }

    if (r.type === "pct_ca" && r.pct && r.pct > 0) {
      const m = Math.round((abonnes * caParClient * r.pct) / 100);
      total += m;
      detail.push({ label: `% CA (${r.pct}%)`, calc: `${abonnes}×${caParClient}€×${r.pct}%`, montant: m });
    }
  }

  return { total, detail };
}
