-- Add client_name to attribution_rows.
-- Source : Stripe charge.billing_details.name (saisi par le client au paiement).
-- Permet la recherche par nom dans /sales/admin/attribution et /sales/ventes
-- (plus naturelle qu'une recherche par email).
ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS client_name text;

COMMENT ON COLUMN public.attribution_rows.client_name IS
  'Nom du client (Stripe billing_details.name). Utilisé pour la recherche par nom dans le tour de contrôle.';
