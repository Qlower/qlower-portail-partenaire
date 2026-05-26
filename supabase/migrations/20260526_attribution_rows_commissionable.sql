-- Permet à l'admin de modifier le montant commissionnable d'une ligne
-- attribution_rows sans toucher au amount_net_eur (qui reste la vérité Stripe).
--
-- Use case : upsell où seul le delta doit être commissionné.
-- Ex: client déjà abonné à 269€, upsell à 479€ → commission sur 210€ (= 479-269),
--     pas sur les 479€ totaux.
--
-- Si commissionable_amount_eur est NULL → on commissionne sur amount_net_eur
-- (comportement standard, rétrocompatible).

ALTER TABLE attribution_rows
  ADD COLUMN IF NOT EXISTS commissionable_amount_eur numeric,
  ADD COLUMN IF NOT EXISTS commissionable_adjusted_reason text,
  ADD COLUMN IF NOT EXISTS commissionable_adjusted_by_email text,
  ADD COLUMN IF NOT EXISTS commissionable_adjusted_at timestamptz;

COMMENT ON COLUMN attribution_rows.commissionable_amount_eur IS
  'Montant commissionné si différent de amount_net_eur (ex: upsell où seul le delta compte). NULL = utiliser amount_net_eur (comportement standard).';
COMMENT ON COLUMN attribution_rows.commissionable_adjusted_reason IS
  'Motif de l''ajustement, obligatoire (audit). Ex: "Upsell : client déjà abonné à 269€".';
