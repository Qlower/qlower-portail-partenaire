-- Système de notation interne des partenaires (NTS = Note Trèfle).
--
-- Logique métier :
--   - Le partenaire note la plateforme Qlower (1-5 trèfles) avec commentaire
--   - Strictement INTERNE par défaut — sert à améliorer le produit
--   - L'admin (Alex) peut "curer" les meilleurs avis pour les decks externes :
--     site partenaire, slides MB, decks invest, présentations big boss
--   - Aucune publication externe sans curation manuelle (RGPD-friendly)
--
-- scope : 'global' | 'plateforme' | 'support' | 'commission' | 'process'
-- used_in : array texte des contextes externes ('site', 'mb_deck', 'invest_deck')

CREATE TABLE IF NOT EXISTS public.partner_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid,
  author_email text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  scope text NOT NULL DEFAULT 'global',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Curation admin (sélection pour usage externe)
  curated boolean NOT NULL DEFAULT false,
  curated_quote text,       -- version nettoyée du commentaire pour les decks
  curator_note text,        -- pourquoi cet avis a été sélectionné
  curated_by text,          -- email de l'admin qui a curé
  curated_at timestamptz,
  used_in text[] DEFAULT '{}'   -- ex: ['site', 'mb_deck']
);

CREATE INDEX IF NOT EXISTS idx_partner_ratings_partner
  ON public.partner_ratings(partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_ratings_curated
  ON public.partner_ratings(curated, rating DESC, created_at DESC)
  WHERE curated;

COMMENT ON TABLE public.partner_ratings IS
  'NTS — Avis internes des partenaires sur Qlower. Pas de publication externe sans curation admin explicite.';
