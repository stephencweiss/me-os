# Plan: Fix Date-Only Format Bug in get_events

## Problem

When calling `get_events` with date-only format (e.g., `startDate: "2026-02-25"`, `endDate: "2026-02-25"`), the tool returns an empty array even when events exist on that date.

### Root Cause

In `mcp/google-calendar/index.ts` at lines 559-567:

```typescript
case "get_events": {
  const { startDate, endDate } = args as {
    startDate: string;
    endDate: string;
  };
  const events = await fetchEventsFromAllAccounts(
    new Date(startDate).toISOString(),
    new Date(endDate).toISOString()
  );
```

When JavaScript parses a date-only string like `"2026-02-25"`:
- `new Date("2026-02-25")` → `2026-02-25T00:00:00.000Z` (midnight UTC)

So when both `startDate` and `endDate` are the same date-only string:
- `timeMin` = `2026-02-25T00:00:00.000Z`
- `timeMax` = `2026-02-25T00:00:00.000Z`

This creates a **zero-length time range**, which returns no events.

### Why Full ISO Format Works

When you pass `"2026-02-25T00:00:00"` and `"2026-02-25T23:59:59"`:
- The range spans the full day
- Events are captured correctly

## Solution

Create a helper function to normalize date inputs:

1. Detect if input is date-only (no `T` in string, or parses to midnight)
2. For `startDate`: Set to start of day in local timezone
3. For `endDate`: Set to end of day (or start of next day) in local timezone

### Implementation

Add a helper function before the `get_events` case:

```typescript
/**
 * Normalizes date input for calendar queries.
 * - Date-only strings (YYYY-MM-DD) are converted to local timezone
 * - For end dates, date-only strings get +1 day to make the range inclusive
 */
function normalizeDateInput(dateStr: string, isEndDate: boolean = false): string {
  // Check if it's a date-only format (no time component)
  const isDateOnly = !dateStr.includes('T');

  if (isDateOnly) {
    // Parse as local date, not UTC
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (isEndDate) {
      // For end date, set to start of NEXT day to make range inclusive
      date.setDate(date.getDate() + 1);
    }

    return date.toISOString();
  }

  // Already has time component, parse normally
  return new Date(dateStr).toISOString();
}
```

Then update the `get_events` case:

```typescript
case "get_events": {
  const { startDate, endDate } = args as {
    startDate: string;
    endDate: string;
  };
  const events = await fetchEventsFromAllAccounts(
    normalizeDateInput(startDate, false),
    normalizeDateInput(endDate, true)
  );
  // ...
}
```

### Also Fix: search_events

The same issue exists in `search_events` (lines 755-768). Apply the same fix there.

## Files to Modify

1. `mcp/google-calendar/index.ts`
   - Add `normalizeDateInput()` helper function
   - Update `get_events` case to use the helper
   - Update `search_events` case to use the helper

## Testing Plan

### Manual Testing

1. **Date-only format (the bug case)**:
   ```
   /calendar tomorrow
   ```
   Should return events for tomorrow.

2. **Same-day range**:
   Call `get_events` with `startDate: "2026-02-25"`, `endDate: "2026-02-25"`
   Should return all events on Feb 25.

3. **Multi-day date-only range**:
   Call `get_events` with `startDate: "2026-02-24"`, `endDate: "2026-02-26"`
   Should return events for Feb 24, 25, and 26.

4. **Full ISO format (regression test)**:
   Call `get_events` with `startDate: "2026-02-25T00:00:00"`, `endDate: "2026-02-25T23:59:59"`
   Should still work correctly.

5. **Mixed formats**:
   Call `get_events` with `startDate: "2026-02-25"`, `endDate: "2026-02-25T23:59:59"`
   Should work correctly.

6. **search_events with date-only**:
   Call `search_events` with query and date-only start/end dates
   Should return matching events.

### Edge Cases to Verify

- Dates at month boundaries (e.g., Jan 31 to Feb 1)
- Dates at year boundaries (e.g., Dec 31 to Jan 1)
- Single-day queries
- Timezone handling (events created in different timezones)

## Rollout

1. Implement the fix
2. Run manual tests
3. Commit and create PR
4. Review and merge
