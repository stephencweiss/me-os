# Plan: Track Calendar ID in Event Responses for Cross-Calendar Updates

## Problem

When events are fetched from non-primary calendars (e.g., "Weiss-McGee Calendar"), the MCP server returns the event but does not include the calendar ID. Update operations then default to `calendarId: "primary"`, causing "Forbidden" errors when trying to update events on secondary calendars.

**Example failure:**
- "Obgyn" event is on "Weiss-McGee Calendar"
- Search finds it correctly with `calendarName: "Weiss-McGee Calendar"`
- `update_event_color` fails because it tries to update on primary calendar
- Works when `calendarId` is explicitly specified

## Root Cause

In `mcp/google-calendar/index.ts`:

1. **`formatEvent()` (lines 73-99)** - includes `calendarName` but not `calendarId`
2. **`fetchEventsFromAllAccounts()` (lines 188-286)** - has access to calendar ID but doesn't pass it to formatEvent
3. **Update functions** - default to `calendarId: "primary"` when not specified

## Implementation Workflow

### Step 0: Save Plan
- Save this plan to `plans/track-calendar-id.md` in the project root

### Step 1: Create Worktree
```bash
./scripts/worktree-start.sh track-calendar-id
```
This creates a dedicated worktree for the feature branch.

### Step 2: Implement Changes (see below)

### Step 3: Testing
- Run existing tests: `npm test`
- Run type check: `npx tsc --noEmit`
- Manual testing with real calendar events on secondary calendars

### Step 4: Commit Changes
- Stage all modified files
- Write clear commit message describing the change
- Ensure no unintended files are included

### Step 5: Create Pull Request
- Push branch to remote
- Create PR with summary covering:
  - Problem being solved
  - Solution approach
  - Files changed
  - Testing performed

---

## Solution

Add `calendarId` to the event response format and use it automatically in update operations.

### Changes Required

#### 1. Update `formatEvent()` signature and output

**File:** `mcp/google-calendar/index.ts` (lines 73-99)

Add `calendarId` parameter and include in output:

```typescript
function formatEvent(
  event: calendar_v3.Schema$Event,
  account: string,
  calendarName?: string,
  calendarType?: CalendarType,
  calendarId?: string  // NEW
): FormattedEvent {
  return {
    id: event.id || "",
    account,
    calendarId: calendarId || "primary",  // NEW
    calendarName: calendarName || "Primary",
    calendarType: calendarType || "active",
    // ... rest unchanged
  };
}
```

#### 2. Update `formatEventCompact()` to include `calendarId`

**File:** `mcp/google-calendar/index.ts` (lines 105-120)

Add `calendarId` to compact format (needed for updates):

```typescript
function formatEventCompact(event: FormattedEvent): CompactEvent {
  return {
    id: event.id,
    account: event.account,
    calendarId: event.calendarId,  // NEW
    summary: event.summary,
    // ... rest unchanged
  };
}
```

#### 3. Pass `calendarId` in `fetchEventsFromAllAccounts()`

**File:** `mcp/google-calendar/index.ts` (around line 260)

The calendar ID is already available as `cal.id` - pass it to `formatEvent`:

```typescript
// Current (around line 260):
const formatted = formatEvent(event, account, calendarName, calType);

// Change to:
const formatted = formatEvent(event, account, calendarName, calType, cal.id);
```

#### 4. Update `findEventInAccounts()` to return `calendarId`

**File:** `mcp/google-calendar/index.ts`

This helper function searches for events across accounts. Update it to also return the calendar ID when found:

```typescript
// Current return type:
{ account: string; event: calendar_v3.Schema$Event }

// New return type:
{ account: string; calendarId: string; event: calendar_v3.Schema$Event }
```

The function needs to search across all calendars (not just primary) and track which calendar the event was found on.

#### 5. Update all update/decline/delete handlers to use `calendarId`

**Files to update in `mcp/google-calendar/index.ts`:**

- `update_event_color` (lines 879-962)
- `update_event_status` (lines 1124-1214)
- `decline_event` (lines 1216-1397)
- `update_event_time` (lines 1399-1490)
- `delete_event` (lines 1492-1568)

For each, when auto-detecting the event:
```typescript
// Current pattern:
const found = await findEventInAccounts(eventId, clients);
const calendarId = args.calendarId || "primary";

// New pattern:
const found = await findEventInAccounts(eventId, clients);
const calendarId = args.calendarId || found?.calendarId || "primary";
```

### Type Updates

#### Update `FormattedEvent` interface

```typescript
interface FormattedEvent {
  id: string;
  account: string;
  calendarId: string;  // NEW
  calendarName: string;
  calendarType: CalendarType;
  // ... rest unchanged
}
```

#### Update `CompactEvent` interface

```typescript
interface CompactEvent {
  id: string;
  account: string;
  calendarId: string;  // NEW
  summary: string;
  // ... rest unchanged
}
```

---

## Testing Plan

### Automated Tests

1. **Unit test:** Verify `formatEvent()` includes `calendarId`
2. **Unit test:** Verify `formatEventCompact()` includes `calendarId`
3. **Unit test:** Verify `findEventInAccounts()` returns `calendarId`

### Integration Tests

1. Mock event on secondary calendar
2. Fetch via `search_events` or `get_events`
3. Verify response includes correct `calendarId`
4. Call update operation without explicit `calendarId`
5. Verify the mock API was called with correct `calendarId`

### Manual Tests

1. **Test case: Update event on secondary calendar**
   - Find "Obgyn" event on "Weiss-McGee Calendar"
   - Call `update_event_color` without specifying `calendarId`
   - Verify update succeeds (previously failed with "Forbidden")

2. **Test case: Update event on primary calendar still works**
   - Find any event on primary calendar
   - Call `update_event_color` without specifying `calendarId`
   - Verify update succeeds (regression test)

3. **Test case: Explicit calendarId still honored**
   - Call update with explicit `calendarId` parameter
   - Verify the explicit value is used (not auto-detected)

---

## Files to Modify

| File | Changes |
|------|---------|
| `mcp/google-calendar/index.ts` | Add calendarId to formatEvent, formatEventCompact, findEventInAccounts, and update handlers |
| `tests/mcp-google-calendar.test.ts` | Add tests for calendarId tracking |
| `plans/track-calendar-id.md` | This plan (copy from ~/.claude/plans/) |

---

## Backward Compatibility

- Adding `calendarId` to responses is non-breaking (additive)
- Update operations still accept explicit `calendarId` parameter (existing behavior)
- Auto-detection falls back to "primary" if not found (existing behavior)
- Existing code that doesn't use `calendarId` continues to work

---

## Estimated Scope

- ~50 lines of code changes in index.ts
- ~30 lines of test additions
- Low risk - additive change with graceful fallback

---

## PR Summary Template

```markdown
## Summary
- Track `calendarId` in event responses to enable updates on non-primary calendars
- Auto-detect calendar ID when updating events, falling back to "primary"

## Problem
Events on secondary calendars (e.g., "Weiss-McGee Calendar") couldn't be updated without explicitly specifying the `calendarId` parameter, because the MCP server defaulted to the primary calendar.

## Solution
- Add `calendarId` field to event response format (full and compact)
- Update `findEventInAccounts()` to search all calendars and return the calendar ID
- Use auto-detected `calendarId` in update operations when not explicitly specified

## Files Changed
- `mcp/google-calendar/index.ts` - core changes
- `tests/mcp-google-calendar.test.ts` - test coverage

## Test Plan
- [x] Existing tests pass (`npm test`)
- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] Manual test: Update event on secondary calendar without explicit calendarId
- [x] Manual test: Update event on primary calendar still works

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
