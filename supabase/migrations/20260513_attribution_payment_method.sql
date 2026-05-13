-- Ajoute payment_method + manual_added_by + manual_note sur attribution_rows.
-- Permet d'ajouter manuellement des paiements hors Stripe (virement, chèque,
-- espèces) qui n'apparaissent pas dans le webhook Stripe.

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe', 'virement', 'cheque', 'especes', 'autre'));

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS manual_added_by text;

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS manual_note text;

COMMENT ON COLUMN public.attribution_rows.payment_method IS
  'Méthode de paiement. stripe = webhook auto. virement/cheque/especes/autre = ajout manuel admin.';
