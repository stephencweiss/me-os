# Calendar Dashboard Webapp - Phase 2 Completion

**GitHub Issue**: https://github.com/stephencweiss/me-os/issues/27
**Related Issues**: #32 (date range buttons), #33 (account/calendar filtering)

## Status

**Phase 1 (Static Dashboard)**: ✅ Complete
**Phase 2 (Interactive Webapp)**: 🔄 In Progress - Missing Features

---

## What's Implemented

- ✅ Next.js webapp with Turso database
- ✅ API routes: `/api/events`, `/api/summaries`, `/api/calendars`, `/api/preferences`
- ✅ `PATCH /api/events` for marking attendance (backend ready)
- ✅ Dashboard with summary cards, pie chart, bar chart, category table
- ✅ Date range buttons (7d, 14d, 30d, 90d) - **but may have a bug**

## What's Missing (This Plan)

1. **Date range buttons not working** (Issue #32) - Investigate and fix
2. **Week markers on bar chart** - Visual indicators for week boundaries
3. **Event list with "did not attend"** - No UI to view/manage individual events
4. **Drill-down into charts** - Cannot click chart segments to see events
5. **Account/calendar filtering** (Issue #33) - No filter UI despite API support

---

## Implementation Plan

### Task 1: Fix Date Range Buttons (Issue #32)

**Problem**: The 7d, 14d, 30d, 90d buttons don't appear to update the data.

**Investigation needed**:
- The code looks correct: `days` state changes → `useEffect` triggers → API call made
- Possible issues: caching, state not updating, or API returning same data

**File to modify**: `webapp/app/components/Dashboard.tsx`

**Tasks**:
1. Add console.log to verify state changes and API calls
2. Check if the API is being called with different date ranges
3. Verify data is actually different for different ranges
4. Fix any caching or state issues found

---

### Task 2: Week Markers on Bar Chart

**Problem**: The bar chart shows daily data but has no visual indicators for week boundaries.

**File to modify**: `webapp/app/components/Dashboard.tsx`

**Approach**: Use Recharts `ReferenceArea` to shade weekends (user preference).

**Implementation**:
```tsx
import { ReferenceArea } from "recharts";

// Shade weekend days with light gray background
{dailyData.map((d, i) =>
  d.isWeekend && (
    <ReferenceArea
      key={`weekend-${i}`}
      x1={d.label}
      x2={d.label}
      fill="#f3f4f6"
      fillOpacity={0.5}
    />
  )
)}
```

**Considerations**:
- Works for all date ranges (7d, 14d, 30d, 90d)
- Weekends will have subtle gray background behind bars
- `isWeekend` already computed from `!s.isWorkDay` in dailyData

---

### Task 3: Event List Component

**Problem**: No UI to view individual events or mark attendance.

**Files to create**: `webapp/app/components/EventList.tsx`

**File to modify**: `webapp/app/components/Dashboard.tsx`

**EventList Component Design**:
```tsx
interface EventListProps {
  events: DbEvent[];
  onAttendanceChange: (eventId: string, attended: string) => void;
  title?: string;
  onClose?: () => void;
}

// Features:
// - Scrollable list of events grouped by date
// - Each event shows: time, summary, calendar, duration, attendance status
// - Toggle button for attendance: attended / skipped / unknown
// - Close button to hide the list
```

**API already exists**: `PATCH /api/events` with `{ eventId, attended }`

**Tasks**:
1. Create `EventList.tsx` component
2. Add state in Dashboard: `selectedEvents`, `showEventList`
3. Add "View Events" button or make charts clickable
4. Call attendance API when user clicks attendance toggle
5. Refresh data after attendance change

---

### Task 4: Drill-Down from Charts

**Problem**: Cannot click chart elements to see related events.

**Files to modify**:
- `webapp/app/components/Dashboard.tsx`

**Implementation**:

**Pie Chart Drill-Down**:
```tsx
<Pie
  onClick={(data) => {
    // data.payload contains the clicked segment
    const colorId = data.payload.colorId;
    fetchEventsForCategory(colorId);
    setShowEventList(true);
  }}
/>
```

**Bar Chart Drill-Down**:
```tsx
<Bar
  onClick={(data) => {
    // data.payload contains the clicked bar
    const date = data.payload.date;
    fetchEventsForDate(date);
    setShowEventList(true);
  }}
/>
```

**Category Table Drill-Down**:
```tsx
<tr
  onClick={() => fetchEventsForCategory(cat.colorId)}
  className="cursor-pointer hover:bg-gray-50"
>
```

**Tasks**:
1. Add click handlers to Pie chart segments
2. Add click handlers to Bar chart bars
3. Add click handlers to Category table rows
4. Fetch events filtered by the clicked element
5. Display in EventList component

---

### Task 5: Account/Calendar Filtering (Issue #33)

**Problem**: No UI to filter by account or calendar.

**Files to create**: `webapp/app/components/FilterBar.tsx`

**File to modify**: `webapp/app/components/Dashboard.tsx`

**FilterBar Component Design**:
```tsx
interface FilterBarProps {
  accounts: string[];
  calendars: { calendar_name: string; account: string }[];
  selectedAccounts: string[];
  selectedCalendars: string[];
  onAccountsChange: (accounts: string[]) => void;
  onCalendarsChange: (calendars: string[]) => void;
}

// Features:
// - Account dropdown (multi-select)
// - Calendar dropdown (multi-select, grouped by account)
// - "Clear filters" button
// - Persist selection in URL query params
```

**API already supports filtering**:
- `GET /api/events?accounts=personal,work&calendars=...`
- `GET /api/summaries` would need to be enhanced to support filtering

**Tasks**:
1. Create `FilterBar.tsx` component with dropdowns
2. Add filter state to Dashboard
3. Pass filters to API calls
4. Update `/api/summaries` to support account/calendar filtering
5. Persist filters in URL and/or user preferences

---

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `webapp/app/components/Dashboard.tsx` | Modify | Add drill-down, event list state, week markers |
| `webapp/app/components/EventList.tsx` | Create | Event list with attendance toggle |
| `webapp/app/components/FilterBar.tsx` | Create | Account/calendar filter dropdowns |
| `webapp/app/api/summaries/route.ts` | Modify | Add account/calendar filtering |
| `webapp/lib/db.ts` | Modify | Add query for events by category |

---

## Testing Plan

### Task 1: Date Range Buttons
- [ ] Click each button (7d, 14d, 30d, 90d)
- [ ] Verify data changes (different totals, more/fewer bars)
- [ ] Console shows different API calls

### Task 2: Week Markers
- [ ] 7d view: Minimal or no week markers
- [ ] 14d view: 1-2 week boundary markers visible
- [ ] 30d view: ~4 week boundary markers visible
- [ ] Weekends visually distinguishable

### Task 3: Event List
- [ ] Event list displays correctly
- [ ] Events show time, summary, calendar, duration
- [ ] Attendance toggle works (attended/skipped/unknown)
- [ ] Attendance persists after refresh

### Task 4: Drill-Down
- [ ] Click pie chart segment → shows events for that category
- [ ] Click bar → shows events for that date
- [ ] Click category table row → shows events for that category

### Task 5: Filtering
- [ ] Can filter by account
- [ ] Can filter by calendar
- [ ] Filters update all charts and cards
- [ ] Clear filters works
- [ ] Filters persist in URL

---

## GitHub Issues

### Issue #32 - Date Range Buttons
- Update with investigation findings and fix details

### Issue #33 - Account/Calendar Filtering
- Update with FilterBar implementation details (Task 5)

### Issue #34 (to create) - Event List and Drill-Down
- Create new issue for Tasks 2, 3 & 4:
  - Week markers (shaded weekends)
  - Event list component with attendance toggle
  - Chart drill-down (pie, bar, table clickable)

---

## Workflow (Jujutsu Stacked Diffs)

Using `jj` with stacked diffs for independent, reviewable PRs.

### Step 0: Save Plan (FIRST ACTION)

**Before any implementation**, save this plan to the project:

```bash
# Copy plan from Claude plans directory to project plans/
cp /Users/sweiss/.claude/plans/ancient-doodling-shannon.md \
   /Users/sweiss/code/worktrees/me-os/calendar-output/plans/phase2-completion.md
```

This creates a permanent record of the work plan in the repository.

### Step 1: Initial Setup
```bash
# We're already in the calendar-output worktree
cd /Users/sweiss/code/worktrees/me-os/calendar-output

# Check jj status
jj status
jj log --limit 5
```

### Step 2: Create Stacked Changes

Each task is an independent jj change that stacks on the previous one. This allows each to be reviewed/merged independently.

**Stack Structure**:
```
main
  └── sw-fix-date-range (Task 1)
        └── sw-week-markers (Task 2)
              └── sw-event-list (Task 3)
                    └── sw-chart-drilldown (Task 4)
                          └── sw-filter-bar (Task 5)
```

**Creating the Stack**:
```bash
# Task 1: Fix date range buttons
jj new -m "fix: date range buttons properly update dashboard data"
# ... implement Task 1 ...
jj bookmark create sw-fix-date-range

# Task 2: Week markers (builds on Task 1)
jj new -m "feat: add weekend shading to bar chart"
# ... implement Task 2 ...
jj bookmark create sw-week-markers

# Task 3: Event list (builds on Task 2)
jj new -m "feat: add EventList component with attendance tracking"
# ... implement Task 3 ...
jj bookmark create sw-event-list

# Task 4: Chart drill-down (builds on Task 3)
jj new -m "feat: add click handlers for chart drill-down"
# ... implement Task 4 ...
jj bookmark create sw-chart-drilldown

# Task 5: Filter bar (builds on Task 4)
jj new -m "feat: add account/calendar filter bar"
# ... implement Task 5 ...
jj bookmark create sw-filter-bar
```

### Step 3: Testing Plan

**Test after each change is implemented**:

```bash
# Start dev server
cd webapp && npm run dev
```

**Task 1 Tests** (Date Range):
- [ ] Click 7d, 14d, 30d, 90d buttons
- [ ] Verify totals change appropriately
- [ ] Bar chart shows correct number of days

**Task 2 Tests** (Week Markers):
- [ ] 14d+ views show shaded weekends
- [ ] Shading appears behind bars, not in front

**Task 3 Tests** (Event List):
- [ ] Event list component renders
- [ ] Events show time, summary, calendar, duration
- [ ] Attendance toggle works (attended/skipped/unknown)
- [ ] Attendance persists after refresh

**Task 4 Tests** (Drill-Down):
- [ ] Click pie segment → event list shows that category
- [ ] Click bar → event list shows that date
- [ ] Click category row → event list shows that category

**Task 5 Tests** (Filtering):
- [ ] Filter by account → charts update
- [ ] Filter by calendar → charts update
- [ ] Clear filters works

**API Testing**:
```bash
# Test attendance update
curl -X PATCH "http://localhost:3000/api/events" \
  -H "Content-Type: application/json" \
  -d '{"eventId": "test-id:2026-02-27", "attended": "skipped"}'

# Verify summaries filtering
curl "http://localhost:3000/api/summaries?start=2026-02-20&end=2026-02-27&accounts=work"
```

### Step 4: Push and Create PRs

Push each bookmark and create separate PRs:

```bash
# Push all bookmarks to remote
jj git push --bookmark sw-fix-date-range
jj git push --bookmark sw-week-markers
jj git push --bookmark sw-event-list
jj git push --bookmark sw-chart-drilldown
jj git push --bookmark sw-filter-bar

# Create PRs (base each on the previous)
gh pr create --base main --head sw-fix-date-range \
  --title "fix: Date range buttons properly update dashboard" \
  --body "$(cat <<'EOF'
## Summary
Fixes the date range buttons (7d, 14d, 30d, 90d) to properly update dashboard data.

## Test plan
- [x] Each button updates the charts and summary cards
- [x] API is called with correct date ranges

Fixes #32

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr create --base sw-fix-date-range --head sw-week-markers \
  --title "feat: Add weekend shading to bar chart" \
  --body "$(cat <<'EOF'
## Summary
Adds visual week markers by shading weekend days on the bar chart.

## Test plan
- [x] Weekends are visually distinguished with gray shading
- [x] Works for all date ranges (14d, 30d, 90d)

Part of #34

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr create --base sw-week-markers --head sw-event-list \
  --title "feat: Add EventList component with attendance tracking" \
  --body "$(cat <<'EOF'
## Summary
New EventList component showing individual events with attendance toggle.

## Features
- Scrollable list of events grouped by date
- Shows time, summary, calendar, duration
- Toggle attendance: attended / skipped / unknown
- Persists to database via PATCH /api/events

## Test plan
- [x] Event list displays correctly
- [x] Attendance toggle works
- [x] Changes persist after refresh

Part of #34

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr create --base sw-event-list --head sw-chart-drilldown \
  --title "feat: Add click handlers for chart drill-down" \
  --body "$(cat <<'EOF'
## Summary
Makes charts clickable to drill down into individual events.

## Features
- Click pie chart segment → shows events in that category
- Click bar chart bar → shows events for that date
- Click category table row → shows events in that category

## Test plan
- [x] All click handlers work
- [x] Correct events shown for each selection

Closes #34

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

gh pr create --base sw-chart-drilldown --head sw-filter-bar \
  --title "feat: Add account and calendar filtering" \
  --body "$(cat <<'EOF'
## Summary
Adds FilterBar component for filtering dashboard by account and calendar.

## Features
- Multi-select account dropdown
- Multi-select calendar dropdown (grouped by account)
- Clear filters button
- Filters update all charts and summary cards

## Test plan
- [x] Can filter by account
- [x] Can filter by calendar
- [x] Clear filters works
- [x] All charts respect filters

Closes #33

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 5: Merge Strategy

PRs should be merged in order (bottom of stack first):
1. `sw-fix-date-range` → main
2. Rebase remaining PRs
3. `sw-week-markers` → main
4. Repeat...

Or merge all at once if reviews complete together:
```bash
# After all PRs approved, merge in order
gh pr merge sw-fix-date-range --squash
# Update other PRs' base branches, then continue
```

