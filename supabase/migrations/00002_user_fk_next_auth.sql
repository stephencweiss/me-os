-- Point public.user_id foreign keys at next_auth.users (NextAuth) instead of auth.users (Supabase Auth).
-- Prerequisite: NextAuth adapter schema is applied (next_auth.users exists).
-- Safe to re-run: drops constraints by IF EXISTS before re-adding.

BEGIN;

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

COMMIT;
