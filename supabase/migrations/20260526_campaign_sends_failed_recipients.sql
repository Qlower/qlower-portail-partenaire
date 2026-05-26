-- Permet le bouton "Renvoyer aux N échecs" dans l'historique des campagnes.
-- Chaque ligne campaign_sends mémorise désormais QUI a échoué (avec son email
-- et l'erreur Resend), pour pouvoir re-cibler uniquement ces destinataires
-- au prochain envoi — sans re-spammer les destinataires déjà OK.

ALTER TABLE campaign_sends
  ADD COLUMN IF NOT EXISTS failed_recipients jsonb;

COMMENT ON COLUMN campaign_sends.failed_recipients IS
  'Array of {partner_id, email, error} for sends that failed. Used to offer a 1-click resend to failures only.';
