-- MeOS Initial Schema for Supabase/Postgres
-- This schema uses Row Level Security (RLS) for multi-tenant data isolation
--
-- Prerequisite: Create the **next_auth** schema and tables for Auth.js / NextAuth
-- (@auth/supabase-adapter) so **next_auth.users** exists before running this file.
-- See: https://authjs.dev/getting-started/adapters/supabase
--
-- All `user_id` columns reference **next_auth.users(id)**, not **auth.users** — the webapp
-- signs in with Google via NextAuth; those user rows live in next_auth, not Supabase Auth.

-- ============================================================================
-- EVENTS TABLE
-- Stores calendar events synced from Google Calendar
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  date DATE NOT NULL,
  account TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  calendar_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  color_id TEXT NOT NULL,
  color_name TEXT NOT NULL,
  color_meaning TEXT NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_event_id TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attended TEXT NOT NULL DEFAULT 'unknown',
  auto_categorized BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_google_id ON events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, date);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "events_select" ON events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "events_update" ON events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "events_delete" ON events FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- DAILY SUMMARIES TABLE
-- Stores computed daily time tracking summaries
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_summaries (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_scheduled_minutes INTEGER NOT NULL,
  total_gap_minutes INTEGER NOT NULL,
  categories_json JSONB NOT NULL DEFAULT '{}',
  is_work_day BOOLEAN NOT NULL DEFAULT TRUE,
  analysis_hours_start INTEGER NOT NULL DEFAULT 9,
  analysis_hours_end INTEGER NOT NULL DEFAULT 17,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_summaries_user ON daily_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_date ON daily_summaries(date);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "summaries_select" ON daily_summaries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "summaries_insert" ON daily_summaries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "summaries_update" ON daily_summaries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "summaries_delete" ON daily_summaries FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- WEEKLY GOALS TABLE
-- Stores user goals for each week
-- ============================================================================
CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,  -- Format: "2026-W10"
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('time', 'outcome', 'habit')),
  color_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK(progress_percent >= 0 AND progress_percent <= 100),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user ON weekly_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_week ON weekly_goals(week_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_week ON weekly_goals(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON weekly_goals(status);

ALTER TABLE weekly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select" ON weekly_goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "goals_insert" ON weekly_goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "goals_update" ON weekly_goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "goals_delete" ON weekly_goals FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- NON-GOALS TABLE
-- Stores anti-patterns / things to avoid
-- ============================================================================
CREATE TABLE IF NOT EXISTS non_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,  -- Regex or keyword pattern to match events
  color_id TEXT,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_non_goals_user ON non_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_non_goals_week ON non_goals(week_id);
CREATE INDEX IF NOT EXISTS idx_non_goals_active ON non_goals(active);

ALTER TABLE non_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "non_goals_select" ON non_goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "non_goals_insert" ON non_goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "non_goals_update" ON non_goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "non_goals_delete" ON non_goals FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- GOAL PROGRESS TABLE
-- Links events to goals for progress tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS goal_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES weekly_goals(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  match_type TEXT NOT NULL CHECK(match_type IN ('auto', 'manual')),
  match_confidence REAL,  -- 0.0 to 1.0 for auto matches
  minutes_contributed INTEGER NOT NULL,
  UNIQUE(goal_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON goal_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_progress_event ON goal_progress(event_id);

ALTER TABLE goal_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_select" ON goal_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress_insert" ON goal_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress_update" ON goal_progress FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "progress_delete" ON goal_progress FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- NON-GOAL ALERTS TABLE
-- Records when events match non-goal patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS non_goal_alerts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  non_goal_id TEXT NOT NULL REFERENCES non_goals(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(non_goal_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON non_goal_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON non_goal_alerts(acknowledged);

ALTER TABLE non_goal_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select" ON non_goal_alerts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "alerts_insert" ON non_goal_alerts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "alerts_update" ON non_goal_alerts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "alerts_delete" ON non_goal_alerts FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- USER PREFERENCES TABLE
-- Key-value store for user settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferences_select" ON user_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "preferences_insert" ON user_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "preferences_update" ON user_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "preferences_delete" ON user_preferences FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- LINKED GOOGLE ACCOUNTS TABLE
-- Stores OAuth tokens for linked Google Calendar accounts
-- ============================================================================
CREATE TABLE IF NOT EXISTS linked_google_accounts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT NOT NULL,
  display_name TEXT,
  account_label TEXT NOT NULL,  -- User-defined: "personal", "work"
  access_token TEXT NOT NULL,   -- Encrypted with AES-256-GCM
  refresh_token TEXT,           -- Encrypted
  token_expiry TIMESTAMPTZ,
  scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, google_email)
);

CREATE INDEX IF NOT EXISTS idx_linked_google_user ON linked_google_accounts(user_id);

ALTER TABLE linked_google_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "google_accounts_select" ON linked_google_accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "google_accounts_insert" ON linked_google_accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "google_accounts_update" ON linked_google_accounts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "google_accounts_delete" ON linked_google_accounts FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_weekly_goals_updated_at
  BEFORE UPDATE ON weekly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linked_google_accounts_updated_at
  BEFORE UPDATE ON linked_google_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE events IS 'Calendar events synced from Google Calendar';
COMMENT ON TABLE daily_summaries IS 'Computed daily time tracking summaries';
COMMENT ON TABLE weekly_goals IS 'User goals scoped to specific weeks';
COMMENT ON TABLE non_goals IS 'Anti-patterns to detect and alert on';
COMMENT ON TABLE goal_progress IS 'Links events to goals for progress tracking';
COMMENT ON TABLE non_goal_alerts IS 'Records when events match non-goal patterns';
COMMENT ON TABLE user_preferences IS 'Key-value store for user settings';
COMMENT ON TABLE linked_google_accounts IS 'OAuth tokens for linked Google accounts';
