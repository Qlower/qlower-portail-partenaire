-- ===========================================================================
-- Add a "system_none" role for virtual commercials representing non-human
-- attribution targets (e.g. autonomous self-service purchases).
--
-- Why: the manager dropdown needs an explicit "Achat autonome (personne)"
-- option, distinct from "leave on auto" (NULL override). We materialise it
-- as a real row in `commercials` so all the attribution plumbing
-- (override_commercial_id, attribution_history) keeps working unchanged.
-- It is then filtered out of the sales leaderboards via role.
-- ===========================================================================

ALTER TABLE public.commercials
  DROP CONSTRAINT IF EXISTS commercials_role_check;

ALTER TABLE public.commercials
  ADD CONSTRAINT commercials_role_check CHECK (
    role = ANY (ARRAY[
      'sales'::text,
      'upsell'::text,
      'support'::text,
      'sales_admin'::text,
      'former'::text,
      'system_none'::text
    ])
  );

-- Sentinel row for "Achat autonome" (= la vente s'est faite sans intervention sales).
-- Stable ID so the front-end can highlight / filter it specifically if needed.
INSERT INTO public.commercials (
  id, hubspot_owner_id, name, role, active, share_fraction, email, user_id
)
VALUES (
  '00000000-0000-0000-0000-aaaaaaaaaaaa',
  'system_autonomous',
  'Achat autonome',
  'system_none',
  true,
  0,
  NULL,
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  active = EXCLUDED.active;
