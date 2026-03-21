-- Soft-delete for events removed from Google within a sync window.

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_events_user_date_active
  ON public.events (user_id, date)
  WHERE removed_at IS NULL;

COMMIT;
