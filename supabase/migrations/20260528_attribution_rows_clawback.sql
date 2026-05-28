-- Gestion des clawbacks pour les refunds post-clôture.
-- Workflow : Stripe webhook flag refunded_after_lock=true sur la ligne d'origine.
-- L'admin doit ensuite décider explicitement :
--   - acknowledged_no_clawback : la boîte assume, le négo garde son commissionnement
--   - applied : on crée une ligne négative dans le mois courant attribuée au négo
--     (le admin saisit le montant — pas auto car le taux historique de commission
--     n'est pas tracké en base : 3%/5%/10% selon atteinte d'objectif à l'époque)
--
-- L'anti-doublon est assuré par clawback_charge_id : pointe vers la ligne
-- négative créée dans le mois courant. Si présent → un clawback est déjà
-- appliqué, le bouton "Apply" est désactivé.

ALTER TABLE attribution_rows
  ADD COLUMN IF NOT EXISTS clawback_status text,
  ADD COLUMN IF NOT EXISTS clawback_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS clawback_charge_id text,
  ADD COLUMN IF NOT EXISTS clawback_amount_eur numeric,
  ADD COLUMN IF NOT EXISTS clawback_decided_by_email text,
  ADD COLUMN IF NOT EXISTS clawback_reason text;

COMMENT ON COLUMN attribution_rows.clawback_status IS
  'NULL=pending arbitrage admin | acknowledged_no_clawback=boite assume | applied=clawback créé';
COMMENT ON COLUMN attribution_rows.clawback_charge_id IS
  'Référence vers la ligne négative créée dans le mois courant. Permet de retirer le clawback proprement (suppression de cette ligne + reset du statut).';
