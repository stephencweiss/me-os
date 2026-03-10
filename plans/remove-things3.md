# Plan: Remove Things 3 Integration - Make Goals Native

**Base Branch**: `goal-creation`
**Goal**: Remove all Things 3 dependencies and make goals fully native to me-os

---

## Summary of Changes

1. **Database**: Remove `things3_id` column, use native UUID for `id`
2. **MCP Server**: DELETE entirely (no repurposing) - use direct DB access instead
3. **Sync Layer**: Delete `lib/things3-sync.ts` and `scripts/sync-goals.ts`
4. **Webapp**: Remove `syncToThings3` UI, add dedicated `/goals` page
5. **API Cleanup**: Remove `/match` and `/progress-sync` endpoints (unused)
6. **Skill**: Rewrite to reference native goals only
7. **Tests**: Update to use native ID format
8. **Dependencies**: Remove `better-sqlite3` (only used by Things 3)

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Dedicated goals page? | **Yes** - Add `/goals` route for standalone management |
| Keep `/progress-sync` and `/match`? | **No** - Remove both (unused) |
| Week ID structure? | **Keep** - `week_id` is fine since all goals are weekly |
| Goal data retention? | **Keep all** - Never delete; visibility controlled by `status` + `week_id` |
| MCP server? | **Delete** - Use direct DB controller like other features |

---

## Phase 1: Database Migration

### Files to Modify
- `lib/calendar-db.ts`
- `webapp/lib/db.ts`

### Changes

**1.1 Update `StoredWeeklyGoal` interface** (`lib/calendar-db.ts`):
```typescript
// Remove things3_id field
export interface StoredWeeklyGoal {
  id: string;        // Native: "goal-{timestamp}-{random}"
  week_id: string;   // e.g., "2026-W10" - scopes goal to a specific week
  title: string;
  // ... rest unchanged
}
```

**1.2 Update schema** in `initDatabase()`:
```sql
CREATE TABLE IF NOT EXISTS weekly_goals (
  id TEXT PRIMARY KEY,
  week_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  estimated_minutes INTEGER,
  goal_type TEXT NOT NULL CHECK(goal_type IN ('time', 'outcome', 'habit')),
  color_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  progress_percent INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- Remove UNIQUE(things3_id, week_id) constraint
-- Remove idx_goals_things3 index
```

**1.3 Add migration function** for existing data:
- Check if `things3_id` column exists
- Migrate existing goals to new ID format
- Drop old column/indexes

**1.4 Update `generateGoalId()`**:
```typescript
function generateGoalId(): string {
  return `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
```

**1.5 Update `upsertWeeklyGoal()`** - remove `things3_id` parameter

**1.6 Mirror changes in `webapp/lib/db.ts`**:
- Remove `generateWebappThings3Id()`
- Update `createGoal()` to use native ID
- Update `DbWeeklyGoal` interface

---

## Phase 2: Delete Things 3 Layer

### Files to DELETE
- `lib/things3-sync.ts`
- `scripts/sync-goals.ts`
- `mcp/things3/` (entire directory)
- `webapp/app/api/goals/sync/route.ts`
- `webapp/app/api/goals/match/route.ts` (unused)
- `webapp/app/api/goals/progress-sync/route.ts` (unused)
- `tests/things3-mcp.test.ts`

### Files to Update
- `lib/weekly-goals.ts` - Remove:
  - `weekIdToThingsTag()`
  - `thingsTagToWeekId()`
  - Any Things 3 imports

### package.json Changes
```json
// Remove script:
"mcp:things3": "node --loader ts-node/esm mcp/things3/index.ts"

// Remove from dependencies:
"better-sqlite3": "^12.6.2"

// Remove from devDependencies:
"@types/better-sqlite3": "^7.6.13"
```

---

## Phase 3: Create Goals Controller

Replace MCP with a simple controller for Claude skill access.

### New File: `lib/goals-controller.ts`

```typescript
/**
 * Goals Controller - Direct database access for goal operations
 * Used by Claude skills and webapp
 */

import { getDb, type StoredWeeklyGoal } from './calendar-db.js';

export interface GoalInput {
  title: string;
  weekId: string;
  notes?: string;
  estimatedMinutes?: number;
  goalType: 'time' | 'outcome' | 'habit';
  colorId?: string;
}

export async function createGoal(input: GoalInput): Promise<StoredWeeklyGoal> {
  // Implementation using existing db functions
}

export async function getGoalsForWeek(weekId: string): Promise<StoredWeeklyGoal[]> {
  // Implementation
}

export async function updateGoal(id: string, updates: Partial<GoalInput>): Promise<StoredWeeklyGoal> {
  // Implementation
}

export async function updateGoalStatus(id: string, status: 'active' | 'completed' | 'cancelled'): Promise<void> {
  // Implementation
}

export async function getGoalById(id: string): Promise<StoredWeeklyGoal | null> {
  // Implementation
}
```

### Update Skill to Use Controller

In `.claude/skills/weekly-goals/SKILL.md`, replace MCP tool calls with:
```typescript
import { createGoal, getGoalsForWeek } from '../../lib/goals-controller.js';
```

---

## Phase 4: Update Webapp

### Files to Delete
- `webapp/app/api/goals/sync/route.ts`
- `webapp/app/api/goals/match/route.ts`
- `webapp/app/api/goals/match/` (directory)
- `webapp/app/api/goals/progress-sync/route.ts`
- `webapp/app/api/goals/progress-sync/` (directory)

### Files to Modify

#### `webapp/app/api/goals/route.ts`
- Delete `generateThings3CreateUrl()` function
- Remove `syncToThings3` from POST handler
- Remove `things3Url` from response

#### `webapp/app/components/GoalForm.tsx`
- Remove `syncToThings3` state
- Remove checkbox UI (~15 lines)
- Remove from `onSave` callback interface
- Update `handleSubmit()`

#### `webapp/app/components/WeeklyGoals.tsx`
- Remove `things3_id` from Goal interface
- Verify no Things 3 references remain

### New: Dedicated Goals Page

#### Create `webapp/app/goals/page.tsx`

Standalone goals management page with:
- Week selector (defaults to current week)
- Goal list with CRUD operations
- Progress tracking display
- Color assignment
- Status management (active/completed/cancelled)

#### Update Navigation
- Add "Goals" link to main nav if one exists
- Or create entry point from dashboard

---

## Phase 5: Update Skill Documentation

### Files to Modify
- `.claude/skills/weekly-goals/SKILL.md`
- `.claude/skills/calendar-optimizer/SKILL.md`
- `CLAUDE.md`
- `plans/weekly-goals.md`

### weekly-goals/SKILL.md Changes
- Remove "Things 3 as source of truth" references
- Replace MCP tools section with controller imports
- Rewrite Add Flow to use controller
- Remove Sync Flow (no longer needed)
- Update Set Flow for native creation

### calendar-optimizer/SKILL.md Changes
- Line 197: Change "Weekly goals from Things 3 (synced to database)" to "Weekly goals from database"
- Review any other Things 3 mentions

### CLAUDE.md Changes
- Update skill description: remove "from Things 3"

### plans/weekly-goals.md
- Archive or update to reflect native-only architecture

---

## Phase 6: Update Calendar Optimizer

### Files to Modify
- `lib/calendar-optimizer.ts`

### Review Functions
- `loadWeeklyGoalsForOptimizer(weekId)` - verify it works with native goals
- `loadAllGoalsForOptimizer(configPath, weekId, include)` - same

These should work fine since they read from the database, not Things 3 directly. Verify no `things3_id` references.

---

## Phase 7: Update Tests

### Files to DELETE
- `tests/things3-mcp.test.ts`
- `tests/goal-progress-sync.test.ts` (endpoint removed)
- `tests/goal-matcher.test.ts` (endpoint removed)

### Files to Modify
- `tests/goal-creation.test.ts`
- `tests/goals-api.test.ts`
- `tests/weekly-goals.test.ts`
- `tests/weekly-goals-e2e.test.ts`

### Changes
- Remove Things 3 URL generation tests
- Remove `things3_id` from test data
- Update ID expectations to match `goal-{timestamp}-{random}` format
- Remove `weekIdToThingsTag`/`thingsTagToWeekId` tests
- Add native ID generation tests
- Add controller tests

---

## Phase 8: Cleanup

### Final Steps
1. Run: `grep -r "things3\|Things3\|Things 3" --include="*.ts" --include="*.tsx" --include="*.md"`
2. Remove any remaining references in comments/docs
3. Update `.claude/settings.local.json` if MCP server is registered there
4. Verify `.mcp.json` doesn't reference Things 3 (confirmed: it doesn't)
5. Run full test suite: `npm run test`
6. Verify webapp builds: `cd webapp && npm run build`

---

## Implementation Order

1. **Phase 1** - Database Migration (foundation)
2. **Phase 3** - Goals Controller (replacement for MCP)
3. **Phase 2** - Delete Things 3 Layer (safe after controller ready)
4. **Phase 4** - Update Webapp + Add Goals Page
5. **Phase 6** - Update Calendar Optimizer
6. **Phase 5** - Update Skill Documentation
7. **Phase 7** - Update Tests (incremental with each phase)
8. **Phase 8** - Cleanup (final pass)

---

## Critical Files

| File | Action |
|------|--------|
| `lib/calendar-db.ts` | Migrate schema, remove things3_id |
| `lib/things3-sync.ts` | DELETE |
| `lib/weekly-goals.ts` | Remove Things 3 tag functions |
| `lib/calendar-optimizer.ts` | Verify native goal loading |
| `lib/goals-controller.ts` | CREATE - new controller |
| `mcp/things3/` | DELETE (entire directory) |
| `webapp/lib/db.ts` | Remove Things 3 ID generation |
| `webapp/app/api/goals/route.ts` | Remove Things 3 URL generation |
| `webapp/app/api/goals/sync/` | DELETE |
| `webapp/app/api/goals/match/` | DELETE |
| `webapp/app/api/goals/progress-sync/` | DELETE |
| `webapp/app/goals/page.tsx` | CREATE - dedicated goals page |
| `webapp/app/components/GoalForm.tsx` | Remove sync checkbox |
| `webapp/app/components/WeeklyGoals.tsx` | Remove things3_id from interface |
| `.claude/skills/weekly-goals/SKILL.md` | Rewrite for native goals |
| `.claude/skills/calendar-optimizer/SKILL.md` | Remove Things 3 reference |
| `scripts/sync-goals.ts` | DELETE |
| `plans/weekly-goals.md` | Archive/update |
| `tests/things3-mcp.test.ts` | DELETE |
| `tests/goal-progress-sync.test.ts` | DELETE |
| `tests/goal-matcher.test.ts` | DELETE |
| `package.json` | Remove mcp script, remove better-sqlite3 |

---

## Files With Things 3 References (Full List)

Found via grep - all 19 files:
1. `package.json`
2. `CLAUDE.md`
3. `webapp/lib/db.ts`
4. `lib/calendar-db.ts`
5. `webapp/app/api/goals/sync/route.ts`
6. `tests/weekly-goals-e2e.test.ts`
7. `tests/goals-api.test.ts`
8. `tests/things3-mcp.test.ts`
9. `tests/goal-progress-sync.test.ts`
10. `mcp/things3/index.ts`
11. `lib/weekly-goals.ts`
12. `webapp/app/components/WeeklyGoals.tsx`
13. `tests/goal-matcher.test.ts`
14. `tests/weekly-goals.test.ts`
15. `plans/weekly-goals.md`
16. `scripts/sync-goals.ts`
17. `lib/things3-sync.ts`
18. `.claude/skills/calendar-optimizer/SKILL.md`
19. `.claude/skills/weekly-goals/SKILL.md`

---

## Goal Visibility Rules

Goals are never deleted. Visibility is controlled by:

| Field | Purpose |
|-------|---------|
| `week_id` | Scopes goal to a week (e.g., "2026-W10") |
| `status` | `active`, `completed`, or `cancelled` |

**Query patterns:**
- Current week's active goals: `WHERE week_id = ? AND status = 'active'`
- All goals for a week: `WHERE week_id = ?`
- Historical view: Query by week_id range

---

## Risk Notes

- **ID format change**: Old IDs were `{things3_id}:{week_id}`, new are `goal-{timestamp}-{random}`
- **Migration**: Existing goals need ID migration before dropping column
- **Dependency removal**: Verified `better-sqlite3` only used in `mcp/things3/index.ts`
- **API removal**: `/match` and `/progress-sync` being removed - confirm these are unused before deleting
