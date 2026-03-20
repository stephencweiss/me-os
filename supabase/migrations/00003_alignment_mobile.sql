-- Phase 1 mobile alignment: weekly audit state (E3) + goal constraints (E4)
-- Apply in Supabase SQL editor (Postgres). For local Turso/SQLite, see bottom.

-- ---------------------------------------------------------------------------
-- weekly_goals.constraints_json (E4) — shared shape with Phase 2 slot-finder
-- ---------------------------------------------------------------------------
ALTER TABLE weekly_goals
  ADD COLUMN IF NOT EXISTS constraints_json JSONB;

COMMENT ON COLUMN weekly_goals.constraints_json IS
  'Optional per-goal windows: e.g. {"workingHours":{"start":9,"end":17},"daysOfWeek":[1,2,3,4,5]}';

-- ---------------------------------------------------------------------------
-- weekly_audit_state (E3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_audit_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES next_auth.users(id) ON DELETE CASCADE,
  week_id TEXT NOT NULL,
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  prompt_count INTEGER NOT NULL DEFAULT 0,
  last_prompt_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_audit_user ON weekly_audit_state(user_id);

ALTER TABLE weekly_audit_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_audit_select" ON weekly_audit_state
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "weekly_audit_insert" ON weekly_audit_state
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "weekly_audit_update" ON weekly_audit_state
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "weekly_audit_delete" ON weekly_audit_state
  FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE weekly_audit_state IS 'Weekly alignment audit dismiss/snooze/backoff (mobile Phase 1)';

-- ---------------------------------------------------------------------------
-- SQLite / Turso (local single-tenant): run separately if needed
-- ---------------------------------------------------------------------------
-- ALTER TABLE weekly_goals ADD COLUMN constraints_json TEXT;
-- CREATE TABLE IF NOT EXISTS weekly_audit_state (
--   week_id TEXT PRIMARY KEY,
--   dismissed_at TEXT,
--   snoozed_until TEXT,
--   prompt_count INTEGER NOT NULL DEFAULT 0,
--   last_prompt_at TEXT,
--   updated_at TEXT NOT NULL
-- );
