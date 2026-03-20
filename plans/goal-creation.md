# Plan: Goal Creation via Claude and Web UI

**GitHub Issue:** https://github.com/stephencweiss/me-os/issues/75

## Overview

Add the ability to create and edit weekly goals through:
1. **Web UI** - Create/edit forms in WeeklyGoals.tsx
2. **Claude Skill** - Conversational `/weekly-goals add` flow
3. **Things 3 Sync** - Two-way sync (goals created anywhere push to Things 3)

---

## Implementation

### Phase 1: API Enhancements

**File:** `web/app/api/goals/route.ts`

1. Enhance `POST /api/goals`:
   - Add `syncToThings3` boolean parameter
   - Return Things 3 URL in response when requested
   - Generate URL using existing `generateCreateGoalUrl()` from lib/things3-sync.ts

2. Add `PUT /api/goals` for editing:
   - Update title, notes, estimatedMinutes, goalType, colorId
   - Validate goal exists before update

**File:** `web/lib/db.ts`

3. Add `updateGoal()` function:
```typescript
export async function updateGoal(goalId: string, updates: {
  title?: string;
  notes?: string | null;
  estimatedMinutes?: number | null;
  goalType?: 'time' | 'outcome' | 'habit';
  colorId?: string | null;
}): Promise<StoredWeeklyGoal>
```

---

### Phase 2: Web UI Components

**New File:** `web/app/components/GoalForm.tsx`

Modal form component with:
- Title (required)
- Notes (optional textarea)
- Estimated time (hours/minutes input)
- Goal type dropdown (Time, Outcome, Habit)
- Color picker (using existing COLOR_MAP)
- "Also create in Things 3" checkbox (default: true)

**New File:** `web/app/components/ColorPicker.tsx`

Reusable color selection using calendar color schema.

**File:** `web/app/components/WeeklyGoals.tsx`

Modifications:
1. Add "Create Goal" button in header (next to week nav)
2. Add edit (pencil) button to each goal row
3. State: `showForm`, `editingGoal`, `isSubmitting`
4. Handlers for create/edit that call API and refresh list
5. Update empty state to show "Create your first goal" button

---

### Phase 3: Things 3 MCP Tool

**File:** `mcp/things3/index.ts`

Add new tool `create_weekly_goal`:
```typescript
{
  name: "create_weekly_goal",
  description: "Generate Things 3 URL to create a goal with 'week' tag",
  inputSchema: {
    properties: {
      title: { type: "string" },
      weekId: { type: "string" },
      notes: { type: "string" },
      estimatedMinutes: { type: "number" }
    },
    required: ["title", "weekId"]
  }
}
```

Returns URL like: `things:///add?title=...&tags=week&deadline=2026-03-08&when=this+week`

Client opens URL to create in Things 3.

---

### Phase 4: Claude Skill

**File:** `.claude/skills/weekly-goals/SKILL.md`

Add "Add Flow" section:

```markdown
### Add Flow (`/weekly-goals add`)

1. Parse user intent: "Add a goal: 4 hours deep work"
2. Infer: title, goalType (time), estimate (240 min), week (current)
3. Confirm with user
4. Create in database via API
5. Generate Things 3 URL, open with `open` command
6. Confirm: "Created in MeOS and Things 3"
```

Example conversation:
```
User: Add a goal for this week: finish the API spec
Claude: Creating outcome goal for 2026-W10:
        - "Finish the API spec"
        Create and sync to Things 3?
User: Yes
Claude: Done! Goal created.
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `web/app/api/goals/route.ts` | Add syncToThings3 to POST, add PUT handler |
| `web/lib/db.ts` | Add updateGoal() function |
| `web/app/components/WeeklyGoals.tsx` | Add create/edit buttons, integrate form |
| `web/app/components/GoalForm.tsx` | **NEW** - Modal form component |
| `web/app/components/ColorPicker.tsx` | **NEW** - Color selection component |
| `mcp/things3/index.ts` | Add create_weekly_goal tool |
| `.claude/skills/weekly-goals/SKILL.md` | Add conversational create flow |

---

## Things 3 Integration Approach

**URL Scheme** (not AppleScript):
- Uses `things:///add?...` format
- Already implemented in `lib/things3-sync.ts` → `generateCreateGoalUrl()`
- Client-side execution (user sees Things 3 open)
- Simpler security model

URL parameters:
- `title` - Goal title
- `tags=week` - Simple "week" tag
- `deadline` - End of target week (e.g., 2026-03-08)
- `when=this week` - Shows in This Week view
- `notes` - Optional notes

---

## Test Strategy

1. **Unit tests** (`tests/goal-creation.test.ts`):
   - createGoal() with required/optional fields
   - updateGoal() modifications
   - generateCreateGoalUrl() output format

2. **API tests**:
   - POST /api/goals validation
   - PUT /api/goals updates
   - Things 3 URL generation

3. **Manual E2E**:
   - Create via Web UI → appears in list + Things 3
   - Edit via Web UI → changes saved
   - Create via Claude → database + Things 3

---

## Implementation Order

1. Database: Add `updateGoal()` to db.ts
2. API: Enhance POST, add PUT to route.ts
3. Components: ColorPicker.tsx, GoalForm.tsx
4. Integration: Update WeeklyGoals.tsx
5. MCP: Add create_weekly_goal tool
6. Skill: Update SKILL.md with add flow
7. Tests: Write and run test suite
