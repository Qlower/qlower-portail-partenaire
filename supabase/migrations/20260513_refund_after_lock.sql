-- Flag pour repérer les remboursements arrivés APRÈS le verrouillage du mois.
-- Cas typique : commission déjà versée au négo, refund tardif → le manager
-- doit voir cet écart pour potentiellement claw-back sur la paie suivante.

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS refunded_after_lock boolean NOT NULL DEFAULT false;

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS refund_post_lock_at timestamptz;

COMMENT ON COLUMN public.attribution_rows.refunded_after_lock IS
  'true si un remboursement Stripe est arrivé alors que le mois était déjà verrouillé.';
