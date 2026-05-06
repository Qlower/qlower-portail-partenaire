-- ===========================================================================
-- Webhook call log — proof of receipt for incoming HubSpot webhook events.
--
-- Goal: when a lead doesn't get attributed, we want to know FACTUALLY whether
-- HubSpot ever called our endpoint or not. The webhook handler inserts one
-- row per incoming POST as the very first thing it does, BEFORE any business
-- logic runs. Even if the handler later crashes, we have proof of receipt.
--
-- The /api/admin/webhook-calls endpoint reads this table.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.webhook_call_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at     timestamptz NOT NULL DEFAULT now(),
  -- Network context
  source_ip       text,                  -- x-forwarded-for / x-real-ip
  user_agent      text,
  has_token       boolean NOT NULL DEFAULT false,
  -- Body context
  events_count    integer DEFAULT 0,
  contact_ids     text[],                -- array of contact ids referenced in events
  body_size       integer,
  body_excerpt    text,                  -- first 500 chars (truncated)
  -- Processing outcome (filled at end of POST handler if it reaches the end)
  http_status     integer,               -- 200, 401, 400, 500
  result_summary  text                   -- e.g. "1 created, 0 skipped"
);

CREATE INDEX IF NOT EXISTS idx_webhook_calls_received
  ON public.webhook_call_log (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_calls_contact_ids
  ON public.webhook_call_log USING GIN (contact_ids);

-- Auto-cleanup: keep only last 30 days. Optional cron job will TRUNCATE older rows.
COMMENT ON TABLE public.webhook_call_log IS
  'Append-only log of incoming HubSpot webhook POSTs. Used to verify whether HubSpot is actually calling our endpoint. Auto-pruned after 30 days.';
