-- Repoint public.user_id foreign keys from auth.users → next_auth.users
--
-- Why: The webapp uses NextAuth + @auth/supabase-adapter. Session user ids live in
-- **next_auth.users**, not **auth.users** (Supabase Auth). Older migrations referenced
-- auth.users, so inserts (e.g. weekly_goals) fail with:
--   violates foreign key constraint "weekly_goals_user_id_fkey"
--
-- Prerequisite: **next_auth.users** must already exist (Auth.js Supabase adapter schema).
--
-- Safe to run once on databases that applied 001 / 003 with auth.users FKs.
-- Idempotent-ish: DROP CONSTRAINT IF EXISTS, then ADD.

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_user_id_fkey;
ALTER TABLE public.events
  ADD CONSTRAINT events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.daily_summaries DROP CONSTRAINT IF EXISTS daily_summaries_user_id_fkey;
ALTER TABLE public.daily_summaries
  ADD CONSTRAINT daily_summaries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.weekly_goals DROP CONSTRAINT IF EXISTS weekly_goals_user_id_fkey;
ALTER TABLE public.weekly_goals
  ADD CONSTRAINT weekly_goals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.non_goals DROP CONSTRAINT IF EXISTS non_goals_user_id_fkey;
ALTER TABLE public.non_goals
  ADD CONSTRAINT non_goals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.goal_progress DROP CONSTRAINT IF EXISTS goal_progress_user_id_fkey;
ALTER TABLE public.goal_progress
  ADD CONSTRAINT goal_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.non_goal_alerts DROP CONSTRAINT IF EXISTS non_goal_alerts_user_id_fkey;
ALTER TABLE public.non_goal_alerts
  ADD CONSTRAINT non_goal_alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE public.user_preferences
  ADD CONSTRAINT user_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

ALTER TABLE public.linked_google_accounts DROP CONSTRAINT IF EXISTS linked_google_accounts_user_id_fkey;
ALTER TABLE public.linked_google_accounts
  ADD CONSTRAINT linked_google_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;

-- From 003_alignment_mobile.sql (skip if table does not exist yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'weekly_audit_state'
  ) THEN
    ALTER TABLE public.weekly_audit_state DROP CONSTRAINT IF EXISTS weekly_audit_state_user_id_fkey;
    ALTER TABLE public.weekly_audit_state
      ADD CONSTRAINT weekly_audit_state_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES next_auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;
