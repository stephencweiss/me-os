# Plan: Fix Filters and Daily Chart View Mode

## Issues to Fix

1. **Filters not working** - Selecting "work" account + "personal" calendar still shows all events
2. **Daily chart is trailing-only** - Need toggle and forward-looking default (Mon-Sun of current week)

---

## Workflow

### Step 0: Create dedicated worktree
```bash
git worktree add ../me-os-filters-fix sw-filters-and-chart-view
```

### Stacked PRs
Each implementation step will be:
1. Implemented in the worktree
2. Verified working
3. Committed independently
4. Pushed as stacked PR

---

## Issue 1: Filters Not Working

### Root Cause Analysis

| Layer | Status | Problem |
|-------|--------|---------|
| FilterBar.tsx | OK | Correctly passes selections |
| Dashboard.tsx (summaries) | OK | Builds URL with filters |
| Dashboard.tsx (events drilldown) | BROKEN | `fetchEvents()` doesn't pass filters |
| /api/summaries/route.ts | BROKEN | Filter params ignored (TODOs on lines 32-34) |
| /api/events/route.ts | OK | Correctly uses filters |
| lib/db.ts getEvents() | OK | SQL filtering works |
| lib/db.ts getDailySummaries() | BROKEN | No filter parameters |

### The Core Problem

Daily summaries are **pre-computed** without account/calendar breakdown. When filters are applied, the API can't filter pre-computed aggregates.

### Solution: Compute summaries from filtered events

When filters are applied, compute aggregates from filtered events on-the-fly instead of using pre-computed summaries.

---

## Implementation Steps (Stacked PRs)

### PR 1: Pass filters to event drilldown calls
**Branch**: `sw-filters-event-drilldown`

**File**: `web/app/components/Dashboard.tsx`

**Changes**:
- Update `fetchEvents()` to accept and use `selectedAccounts` and `selectedCalendars`
- Update `fetchEventsForDate()` to pass filters
- Update `fetchEventsForCategory()` to pass filters

**Verify**: Click on bar chart date or pie slice with filters applied → event list respects filters

**Commit**: `fix(webapp): pass account/calendar filters to event drilldown API calls`

---

### PR 2: Add filtered summaries computation
**Branch**: `sw-filters-summaries` (stacked on PR 1)

**Files**:
- `web/lib/db.ts`
- `web/app/api/summaries/route.ts`

**Changes in db.ts**:
- Add `getFilteredDailySummaries(startDate, endDate, options)` function
- Query events table with account/calendar filters
- Group by date and aggregate: total minutes, gap minutes, categories

**Changes in summaries/route.ts**:
- Uncomment filter parameter parsing (lines 32-34)
- When filters present: call `getFilteredDailySummaries()`
- When no filters: use existing `getDailySummaries()` (fast path)

**Verify**: Select "work" account → totals and charts update to show only work events

**Commit**: `feat(webapp): implement account/calendar filtering for summaries API`

---

### PR 3: Add view mode toggle (trailing vs forward)
**Branch**: `sw-chart-view-mode` (stacked on PR 2)

**File**: `web/app/components/Dashboard.tsx`

**Changes**:

1. Add state:
```tsx
const [viewMode, setViewMode] = useState<'trailing' | 'forward'>('forward');
```

2. Add helper function:
```tsx
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
```

3. Update date calculation in useEffect:
```tsx
let start: Date, end: Date;
if (viewMode === 'forward') {
  start = getMondayOfWeek(new Date());
  end = new Date(start);
  end.setDate(start.getDate() + days - 1);
} else {
  end = new Date();
  start = new Date();
  start.setDate(start.getDate() - days);
}
```

4. Add segmented control UI next to days buttons:
```tsx
<div className="flex gap-2">
  <div className="flex rounded-lg overflow-hidden border">
    <button onClick={() => setViewMode('trailing')}
            className={viewMode === 'trailing' ? 'bg-blue-600 text-white' : '...'}>
      Past
    </button>
    <button onClick={() => setViewMode('forward')}
            className={viewMode === 'forward' ? 'bg-blue-600 text-white' : '...'}>
      This Week
    </button>
  </div>
  {[7, 14, 30, 90].map((d) => (...))}
</div>
```

**Verify**:
- Default shows Monday-Sunday of current week
- Toggle to "Past" shows trailing 7 days
- 14d in forward mode shows Monday + 13 days

**Commit**: `feat(webapp): add trailing/forward view mode toggle for daily chart`

---

## Files Modified (Summary)

| PR | Files |
|----|-------|
| PR 1 | `web/app/components/Dashboard.tsx` |
| PR 2 | `web/lib/db.ts`, `web/app/api/summaries/route.ts` |
| PR 3 | `web/app/components/Dashboard.tsx` |

---

## Testing Checklist

### Filter Tests (PR 1 & 2)
- [ ] Select "work" account only → only work events in totals
- [ ] Select "personal" calendar only → only personal calendar events
- [ ] Select "work" + "Personal" calendar → should show 0 if no overlap
- [ ] Click on bar chart date → event list respects filters
- [ ] Click on pie chart category → event list respects filters

### View Mode Tests (PR 3)
- [ ] Default view shows Monday-Sunday of current week
- [ ] Toggle to "Past" shows trailing 7 days
- [ ] 14d in forward mode shows Monday + 13 days
- [ ] Bar chart labels show correct dates for each mode
