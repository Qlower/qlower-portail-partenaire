-- Champs juridiques nécessaires à la génération automatique du contrat BTOB
-- (Affiliation & Marque Blanche - 2026)
--
-- Le PDF généré utilise 11 placeholders [[prospect.xxx]]. La majorité sont
-- déjà couverts par les colonnes existantes (nom, siret, adresse, ville,
-- code_postal, contact_prenom, contact_nom). Il manquait les 5 ci-dessous
-- propres au cartouche juridique d'en-tête de contrat.

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS forme_juridique text,     -- "Société par actions simplifiée", "SARL", "SAS"...
  ADD COLUMN IF NOT EXISTS capital text,             -- "10 000 €" (texte libre pour respecter mises en forme légales)
  ADD COLUMN IF NOT EXISTS rcs text,                 -- "Paris", "Nanterre"... ville du greffe d'immatriculation
  ADD COLUMN IF NOT EXISTS contact_civilite text,    -- "M." | "Mme"
  ADD COLUMN IF NOT EXISTS contact_position text;    -- "Président", "Gérant", "Directeur Général"...

COMMENT ON COLUMN partners.forme_juridique IS 'Type de société (SAS, SARL...) pour le cartouche de contrat';
COMMENT ON COLUMN partners.capital IS 'Capital social, texte libre (ex: "10 000 €")';
COMMENT ON COLUMN partners.rcs IS 'Ville du RCS d''immatriculation';
COMMENT ON COLUMN partners.contact_civilite IS 'Civilité du signataire (M. ou Mme)';
COMMENT ON COLUMN partners.contact_position IS 'Fonction du signataire (Président, Gérant...)';
