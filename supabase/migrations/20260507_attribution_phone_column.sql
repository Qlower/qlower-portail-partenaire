-- Add phone column to attribution_rows so the hourly rescore cron can use it
-- to lookup HubSpot contacts by phone (cas Baptiste Perlin : 2 fiches HubSpot
-- pour le même client, l'attribution n'aller que sur la fiche du paiement
-- alors que les efforts commerciaux étaient sur l'autre fiche).

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS phone text;

COMMENT ON COLUMN public.attribution_rows.phone IS
  'Téléphone client (Stripe billing_details ou customer.phone). Utilisé pour fusionner les fiches HubSpot dupliquées au scoring.';
