-- Table pour stocker les groupes de doublons probables détectés dans HubSpot.
--
-- Alimentée par le scan /api/admin/detect-duplicates (déclenché manuellement
-- depuis /admin/doublons, pour éviter de consommer un slot Vercel cron Hobby).
-- Chaque ligne = un groupe de 2+ fiches HubSpot suspectées d'être la même
-- personne. Le manager peut résoudre la ligne (= "j'ai fusionné" ou "faux positif").

CREATE TABLE IF NOT EXISTS public.hubspot_duplicates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quel critère a fait matcher : 'phone_last9' | 'name_normalized'
  match_signal text NOT NULL,
  -- Valeur normalisée (ex: "612345678" pour un tél, ou "baptisteperlin" pour un nom)
  match_value text NOT NULL,
  -- Les fiches matchées (au moins 2)
  contact_ids text[] NOT NULL,
  contact_emails text[],
  contact_names text[],
  contact_owners text[],
  -- Heuristique 0-100 : plus c'est haut, plus c'est probable (phone match > name match)
  score smallint NOT NULL DEFAULT 0,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  resolution_note text
);

CREATE INDEX IF NOT EXISTS idx_hsdup_match
  ON public.hubspot_duplicates(match_signal, match_value);

CREATE INDEX IF NOT EXISTS idx_hsdup_resolved_detected
  ON public.hubspot_duplicates(resolved, detected_at DESC);

COMMENT ON TABLE public.hubspot_duplicates IS
  'Groupes de doublons HubSpot détectés par scan manuel ou automatique. Utilisé par /admin/doublons.';
