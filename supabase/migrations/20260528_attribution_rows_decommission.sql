-- Découplage CA / commission pour les refunds.
--
-- Auparavant : refund auto-attribué au négo de la vente d'origine
--   → son CA baisse + sa commission baisse mécaniquement.
-- Désormais : refund non attribué par défaut (CA équipe baisse seul).
--   L'admin peut explicitement décider de retenir un montant sur la paie
--   d'un négo via les colonnes decommission_*.
--
-- Le CA affiché du négo ne baisse JAMAIS. La retenue est un montant
-- additionnel tracké séparément, à appliquer sur la paie commission de
-- fin de mois (manuellement pour l'instant — calculé par l'admin selon
-- le taux historique 3 %/5 %/10 % qui s'appliquait à l'époque de la vente).

ALTER TABLE attribution_rows
  ADD COLUMN IF NOT EXISTS decommission_commercial_id text,
  ADD COLUMN IF NOT EXISTS decommission_amount_eur numeric,
  ADD COLUMN IF NOT EXISTS decommission_reason text,
  ADD COLUMN IF NOT EXISTS decommission_set_by_email text,
  ADD COLUMN IF NOT EXISTS decommission_set_at timestamptz;

COMMENT ON COLUMN attribution_rows.decommission_commercial_id IS
  'Négo dont la commission de paie va être retenue pour cette ligne refund. NULL = pas de décommissionnement (la boîte/équipe assume).';
COMMENT ON COLUMN attribution_rows.decommission_amount_eur IS
  'Montant en € à retenir sur la prochaine paie commission du négo (saisi à la main par admin car dépend du taux historique 3%/5%/10%).';
COMMENT ON COLUMN attribution_rows.decommission_reason IS
  'Motif libre fourni par admin pour audit.';
