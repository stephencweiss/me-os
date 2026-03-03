# Weekly Goals Feature - Implementation Plan

> **Plan Location**: This plan should be committed to `plans/weekly-goals.md`

---

## Development Workflow

### Worktree Setup
```bash
# Create dedicated worktree for this feature
git worktree add ../me-os-weekly-goals -b sw-weekly-goals-base
cd ../me-os-weekly-goals
```

### Jujutsu Stacked PRs

Each implementation phase becomes an independent, verifiable PR using `jj`:

```bash
# Initialize jj in the worktree (if not already)
jj git init --colocate

# Create stacked changes - each phase is a separate commit
jj new -m "feat(db): add weekly goals database schema"
# ... implement phase 1 ...
jj commit

jj new -m "feat(lib): add Things 3 sync integration"
# ... implement phase 2 ...
jj commit

jj new -m "feat(skill): add /weekly-goals skill"
# ... implement phase 3 ...
jj commit

jj new -m "feat(webapp): add goals dashboard component"
# ... implement phase 4 ...
jj commit

jj new -m "test: add weekly goals e2e tests"
# ... implement phase 5 ...
jj commit
```

### PR Stack

| PR # | Branch | Depends On | Description |
|------|--------|------------|-------------|
| 1 | `sw-weekly-goals-db` | main | Database schema for goals, non-goals, progress |
| 2 | `sw-weekly-goals-lib` | PR #1 | Core libraries (weekly-goals.ts, things3-sync.ts, goal-matcher.ts) |
| 3 | `sw-weekly-goals-skill` | PR #2 | `/weekly-goals` skill + optimizer integration |
| 4 | `sw-weekly-goals-webapp` | PR #3 | Dashboard component + API routes |
| 5 | `sw-weekly-goals-tests` | PR #4 | E2E tests and documentation |

### Pushing Stacked PRs
```bash
# Push each change as a separate branch for PR
jj git push --change <change-id-1> --branch sw-weekly-goals-db
jj git push --change <change-id-2> --branch sw-weekly-goals-lib
# ... etc

# Create PRs with gh, noting dependencies
gh pr create --base main --head sw-weekly-goals-db --title "feat(db): weekly goals schema"
gh pr create --base sw-weekly-goals-db --head sw-weekly-goals-lib --title "feat(lib): Things 3 sync"
# ... etc
```

---

## Overview

A weekly goals tracking system that uses **Things 3 as the source of truth**, integrates with the **web dashboard** for visibility, provides a new **`/weekly-goals` skill** for management, and feeds into the **`/calendar-optimizer`** for time allocation.

## User Requirements

| Requirement | Solution |
|-------------|----------|
| Things 3 as source of truth | Sync via MCP server, week tags like `#w14-2026` |
| Web app visibility | New dashboard component + API endpoints |
| New /weekly-goals skill | Full CRUD + interactive flows |
| Integration with optimizer | Optimizer consumes active weekly goals |
| Hybrid progress tracking | Auto-match events by color/keywords, prompt for ambiguous |
| Non-goals as anti-patterns | Detect matching events and alert |

## Architecture

```
Things 3 (macOS)
    ↓ sync via MCP
SQLite/Turso Database (weekly_goals, goal_progress, non_goals, non_goal_alerts)
    ↓ API routes
Next.js Dashboard (WeeklyGoals component)
    ↑ skill invocation
/weekly-goals skill ← → /calendar-optimizer
```

---

## Database Schema

Add to `lib/calendar-db.ts`:

```sql
-- Weekly goals synced from Things 3
CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,                    -- things3_id + week_id composite
  things3_id TEXT NOT NULL,
  week_id TEXT NOT NULL,                  -- ISO week: "2026-W14"
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  goal_type TEXT NOT NULL,                -- 'time' | 'outcome' | 'habit'
  color_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'cancelled'
  progress_percent INTEGER DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(things3_id, week_id)
);

-- Non-goals (anti-patterns) - week-scoped
CREATE TABLE IF NOT EXISTS non_goals (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,                  -- ISO week: "2026-W14"
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,                  -- Regex to match events
  color_id TEXT,
  reason TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_non_goals_week ON non_goals(week_id);

-- Goal-to-event matching for progress
CREATE TABLE IF NOT EXISTS goal_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  matched_at TEXT NOT NULL,
  match_type TEXT NOT NULL,               -- 'auto' | 'manual'
  match_confidence REAL,
  minutes_contributed INTEGER NOT NULL,
  UNIQUE(goal_id, event_id)
);

-- Alerts when events match non-goals
CREATE TABLE IF NOT EXISTS non_goal_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  non_goal_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  UNIQUE(non_goal_id, event_id)
);
```

---

## New Files

| File | Purpose |
|------|---------|
| `lib/weekly-goals.ts` | Core CRUD, week utilities, progress calculation |
| `lib/things3-sync.ts` | Things 3 MCP sync logic |
| `lib/goal-matcher.ts` | Event-to-goal matching heuristics |
| `.claude/skills/weekly-goals/SKILL.md` | Skill definition |
| `webapp/app/api/goals/route.ts` | Goals API endpoint |
| `webapp/app/api/non-goals/route.ts` | Non-goals API endpoint |
| `webapp/app/components/WeeklyGoals.tsx` | Dashboard component |
| `config/non-goals.json` | Default anti-patterns |
| `scripts/sync-goals.ts` | CLI sync script |

---

## /weekly-goals Skill Flows

### Default (`/weekly-goals`)
1. Sync from Things 3 (filter by current week tag)
2. Load progress from database
3. Display goals with progress bars
4. Show non-goal alerts
5. Offer interactive options (match events, mark complete, add goal)

### Set (`/weekly-goals set`)
1. Ask for goals in natural language
2. Parse into structured format
3. Create in Things 3 with week tag (e.g., `#w14-2026`)
4. Save to local database

### Sync (`/weekly-goals sync`)
1. Pull goals from Things 3 by week tag
2. Upsert to local database
3. Report changes

### Review (`/weekly-goals review`)
1. Load week's calendar events
2. Run auto-matching (color + keywords)
3. Prompt for ambiguous matches
4. Update progress
5. Check non-goal patterns, create alerts

### Non-goals (`/weekly-goals non-goals`)
1. List existing patterns
2. Add/edit/remove patterns
3. Test pattern against recent events

---

## Event-to-Goal Matching

Confidence scoring (0-1):
- **Color match**: +0.4 (goal colorId matches event color)
- **Title keywords**: +0.35 (words from goal title appear in event summary)
- **Notes/description**: +0.25 (goal notes match event description)

Threshold: **>0.5** = auto-match, **0.3-0.5** = prompt user, **<0.3** = no match

---

## Web Dashboard Component

`WeeklyGoals.tsx` features:
1. **Progress bars** for each goal (colored by goal color)
2. **Summary cards** (total goals, completed, avg progress)
3. **Non-goal alerts** panel with dismiss/acknowledge
4. **Week selector** for viewing past/future weeks
5. **Quick actions** (sync, add goal, review)

Add as new section in existing `Dashboard.tsx`.

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/goals` | GET | Get goals for week (query: `?week=2026-W14`) |
| `/api/goals` | POST | Create goal |
| `/api/goals` | PATCH | Update progress/status |
| `/api/goals/sync` | POST | Trigger Things 3 sync |
| `/api/goals/match` | POST | Auto-match events to goals |
| `/api/non-goals` | GET | List non-goal patterns |
| `/api/non-goals` | POST | Create non-goal |
| `/api/non-goals/alerts` | GET | Get alerts |
| `/api/non-goals/alerts/:id` | PATCH | Acknowledge alert |

---

## Calendar Optimizer Integration

Modify `lib/calendar-optimizer.ts`:

```typescript
export async function loadWeeklyGoalsForOptimizer(): Promise<TimeGoal[]> {
  const goals = await getGoalsForWeek(getCurrentWeekId());
  return goals
    .filter(g => g.goalType === 'time' && g.status === 'active')
    .map(g => ({
      id: `weekly-${g.id}`,
      name: g.title,
      totalMinutes: g.estimatedMinutes || 120,
      // Subtract progress already made
      _remainingMinutes: (g.estimatedMinutes || 120) * (1 - g.progressPercent / 100),
      colorId: g.colorId || '2',
      priority: 1,
      recurring: false
    }));
}
```

---

## Things 3 Integration

### MCP Server
Install existing `mcp-things3` server: https://github.com/drjforrest/mcp-things3

Tools used:
- `search-things3-todos` - Search by week tag
- `create-things3-todo` - Create goals with tags
- `complete-things3-todo` - Mark complete

### Week Tag Format
- Things tag: `w14-2026` (lowercase, no hash in storage)
- Database week_id: `2026-W14` (ISO format)

### Sync Logic
1. Search Things 3 for todos with week tag
2. Parse week tag to determine scope
3. Upsert to `weekly_goals` table
4. If Things 3 shows complete, update local status

---

## Implementation Phases (PR Stack)

### PR 1: Database Schema (`sw-weekly-goals-db`)
**Commit**: `feat(db): add weekly goals database schema`

Files changed:
- [ ] `lib/calendar-db.ts` - Add 4 tables + indexes

Verification:
- [ ] Run `npm run db:migrate` (if applicable)
- [ ] Verify tables created with `turso db shell`
- [ ] Unit tests pass

### PR 2: Core Libraries (`sw-weekly-goals-lib`)
**Commit**: `feat(lib): add Things 3 sync integration`

Files changed:
- [ ] `lib/weekly-goals.ts` - CRUD, week utils, progress calc
- [ ] `lib/things3-sync.ts` - Things 3 MCP sync logic
- [ ] `lib/goal-matcher.ts` - Event-to-goal matching heuristics
- [ ] `scripts/sync-goals.ts` - CLI sync script

Verification:
- [ ] Unit tests for week ID calculation
- [ ] Unit tests for goal matching confidence
- [ ] Manual test: sync-goals.ts runs without error

### PR 3: Skill Implementation (`sw-weekly-goals-skill`)
**Commit**: `feat(skill): add /weekly-goals skill`

Files changed:
- [ ] `.claude/skills/weekly-goals/SKILL.md` - Full skill definition
- [ ] `lib/calendar-optimizer.ts` - Add `loadWeeklyGoalsForOptimizer()`
- [ ] `.claude/skills/calendar-optimizer/SKILL.md` - Document integration
- [ ] `CLAUDE.md` - Add weekly-goals to skill registry

Verification:
- [ ] `/weekly-goals` shows current week
- [ ] `/weekly-goals set` creates in Things 3
- [ ] `/weekly-goals sync` pulls from Things 3
- [ ] `/calendar-optimizer` includes weekly goals

### PR 4: Web Dashboard (`sw-weekly-goals-webapp`)
**Commit**: `feat(webapp): add goals dashboard component`

Files changed:
- [ ] `webapp/app/api/goals/route.ts` - Goals CRUD API
- [ ] `webapp/app/api/non-goals/route.ts` - Non-goals API
- [ ] `webapp/app/components/WeeklyGoals.tsx` - Dashboard component
- [ ] `webapp/app/components/Dashboard.tsx` - Integrate WeeklyGoals

Verification:
- [ ] API endpoints return correct data
- [ ] Goals component renders in dashboard
- [ ] Non-goal alerts display correctly
- [ ] `npm run build` succeeds

### PR 5: Tests & Documentation (`sw-weekly-goals-tests`)
**Commit**: `test: add weekly goals e2e tests`

Files changed:
- [ ] `lib/__tests__/weekly-goals.test.ts` - Unit tests
- [ ] `lib/__tests__/goal-matcher.test.ts` - Matching tests
- [ ] `plans/weekly-goals.md` - Commit this plan
- [ ] Update any remaining documentation

Verification:
- [ ] All unit tests pass
- [ ] E2E: set goals → sync → add events → review → verify progress
- [ ] E2E: non-goal detection alerts work

---

## Testing Strategy

### Unit Tests
- Week ID calculation edge cases (Jan 1, Dec 31, leap years)
- Goal matching confidence scoring
- Regex pattern matching for non-goals

### Integration Tests
- Things 3 sync (requires macOS)
- Event-to-goal matching with seeded data
- API endpoint CRUD operations

### E2E Tests
- Full weekly flow: set goals -> sync -> add events -> review -> verify progress
- Non-goal detection: configure pattern -> create matching event -> verify alert

---

## Critical Files to Modify

1. `lib/calendar-db.ts` - Add 4 new tables
2. `lib/calendar-optimizer.ts` - Add weekly goals loader
3. `webapp/app/components/Dashboard.tsx` - Add WeeklyGoals section
4. `.claude/skills/calendar-optimizer/SKILL.md` - Document integration
5. `CLAUDE.md` - Add weekly-goals to skill registry

---

## Open Questions (Resolved)

- [x] Task system: **Things 3** (user's choice)
- [x] Workflow: **Both integrated** (new skill + optimizer integration)
- [x] Progress tracking: **Hybrid** (auto + manual)
- [x] Non-goals: **Track as anti-patterns** (alert on matches)
- [x] Non-goal scope: **Week-scoped** (anti-patterns defined per week)
