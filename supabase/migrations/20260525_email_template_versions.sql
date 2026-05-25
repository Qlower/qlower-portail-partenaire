-- Snapshots des email_templates pour pouvoir revenir en arrière.
-- À chaque sauvegarde d'un template, on archive l'état précédent dans cette
-- table (label="Auto-save" si la sauvegarde n'a pas de nom explicite).
-- Coline peut donc faire des modifs, et si elle n'aime pas, restaurer la
-- version précédente.

CREATE TABLE IF NOT EXISTS email_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  label text,
  saved_at timestamptz NOT NULL DEFAULT now(),
  saved_by_email text
);

CREATE INDEX IF NOT EXISTS email_template_versions_template_idx
  ON email_template_versions(template_id, saved_at DESC);

COMMENT ON TABLE email_template_versions IS
  'Snapshots of email_templates : auto-saved on every update + manually named ones. Used to restore a previous version.';
COMMENT ON COLUMN email_template_versions.label IS
  'Optional human-friendly name (e.g. "Validé par Alex"). NULL = auto-save.';
