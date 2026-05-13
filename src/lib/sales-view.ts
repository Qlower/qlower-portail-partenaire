// Résolution de la vue active pour le tour de contrôle sales.
//
// Vues possibles (dans l'URL ?view=) :
//   - "team"          : équipe entière (défaut admin)
//   - <commercial_id> : un commercial spécifique
//   - "unassigned"    : lignes non attribuées
//   - "autonome"      : role=system_none
//   - "support"       : role=support
//   - "former"        : role=former (anciens collaborateurs)
//
// Logique de résolution :
//   1. Si URL ?view= explicite → on respecte (sauf "team" non admin)
//   2. Sinon : sales_admin → "team", sales → leur commercial_id, autres → null

export interface ResolvedViewInput {
  /** Raw `?view=` value depuis l'URL */
  viewParam?: string | string[];
  /** Internal role du user connecté */
  internalRole?: string | null;
  /** Commercial id du user connecté (si lié) */
  myCommercialId?: string | null;
}

/**
 * Renvoie la vue résolue à utiliser pour filtrer le speedometer et le tableau.
 * Si l'utilisateur ne devrait rien voir (pas d'auth interne), renvoie null.
 */
export function resolveSalesView(input: ResolvedViewInput): string | null {
  const isAdmin = input.internalRole === "sales_admin";
  const isSales = input.internalRole === "sales";
  if (!isAdmin && !isSales) return null;

  const raw = Array.isArray(input.viewParam) ? input.viewParam[0] : input.viewParam;

  // URL param explicite
  if (raw) {
    // "team" autorisé uniquement aux admins
    if (raw === "team") return isAdmin ? "team" : input.myCommercialId || null;
    return raw;
  }

  // Pas de URL param → défaut selon rôle
  if (isAdmin) return "team";
  return input.myCommercialId || null;
}
