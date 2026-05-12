-- Ajoute le nom de produit détaillé sur attribution_rows.
-- Source : Stripe invoice.lines.data[0].price.product.name (via expand au webhook),
-- ou fallback sur charge.description si pas d'invoice.
--
-- Utilisé pour analyser le mix produits dans /sales/rapport et déléguer un
-- classement plus fin que la family (qui reste catégorique).

ALTER TABLE public.attribution_rows
  ADD COLUMN IF NOT EXISTS product_name text;

COMMENT ON COLUMN public.attribution_rows.product_name IS
  'Nom du produit Stripe (depuis invoice.lines ou charge.description). Plus fin que family.';
