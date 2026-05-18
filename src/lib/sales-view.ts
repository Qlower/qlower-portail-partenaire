// Résolution de la vue active pour le tour de contrôle sales.
//
// IMPORTANT : 2 dimensions distinctes !
//   - `tableView` : quelle filtration appliquer au tableau (rows visibles)
//   - `speedometerView` : quel scope pour le speedometer + cards Jour/Sem/Mois
//
// Logique par rôle :
//
//   sales_admin (manager) :
//     - ?view= explicite contrôle LES DEUX (table + speedometer)
//     - Sans ?view= : team par défaut (vue d'ensemble)
//
//   sales (négo) :
//     - tableView : TOUJOURS "team" → voit toutes les ventes équipe
//       (pour pouvoir contester ou réclamer des attributions d'autres collègues)
//     - speedometerView : TOUJOURS son commercial_id → son compteur perso
//     - L'URL ?view= est ignoré pour les sales (pas de dropdown pour eux)

export interface ResolvedViewInput {
  viewParam?: string | string[];
  internalRole?: string | null;
  myCommercialId?: string | null;
}

export interface ResolvedView {
  tableView: string;        // filtre pour le tableau ("team" | commercial_id | "unassigned" | ...)
  speedometerView: string;  // scope pour le speedometer (idem syntaxe)
}

export function resolveSalesView(input: ResolvedViewInput): ResolvedView | null {
  const isAdmin = input.internalRole === "sales_admin";
  const isSales = input.internalRole === "sales";
  if (!isAdmin && !isSales) return null;

  if (isAdmin) {
    // Admin : ?view explicite contrôle tout, sinon team
    const raw = Array.isArray(input.viewParam) ? input.viewParam[0] : input.viewParam;
    const view = raw || "team";
    return { tableView: view, speedometerView: view };
  }

  // Sales : tableau = toute l'équipe (sinon impossible de contester / réclamer).
  // Speedometer = son propre objectif perso.
  return {
    tableView: "team",
    speedometerView: input.myCommercialId || "",
  };
}
