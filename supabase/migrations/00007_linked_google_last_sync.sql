-- Track last successful calendar sync completion per linked Google account (backoff / UX).
ALTER TABLE public.linked_google_accounts
  ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.linked_google_accounts.last_sync_completed_at IS
  'UTC time of last completed runCalendarSync for this row; used for 1-minute skip window.';
