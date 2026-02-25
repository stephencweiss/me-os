# Plan: Reduce Calendar MCP Output Size

## Problem

The Google Calendar MCP server returns very large JSON responses that quickly fill up the context window. A single day's events can return 40+ event objects, each with full metadata including long descriptions, HTML links, and duplicate entries from multiple calendars viewing the same event.

### Current Issues

1. **Duplicate events**: Same event appears multiple times when viewed from different calendars (e.g., personal calendar synced to work account shows the event twice)
2. **Verbose fields**: `htmlLink`, `description` (can be very long HTML), and `location` are always included
3. **No pagination or limits**: All events returned regardless of count
4. **No summary mode**: Always returns full details even when a summary would suffice

### Example of Redundancy

The same event "Morning Routine" appears twice:
```json
{ "account": "personal", "calendarName": "Primary", "summary": "Morning Routine", ... }
{ "account": "work", "calendarName": "Personal", "summary": "Morning Routine", ... }
```

## Solution

Implement multiple strategies to reduce output size:

### 1. Deduplicate Events by ID

Events have unique IDs. When the same event is visible from multiple calendars, only return it once (prefer the primary/owner calendar).

**Implementation**:
```typescript
// In fetchEventsFromAllAccounts, before returning:
const seenIds = new Set<string>();
const dedupedEvents = allEvents.filter(event => {
  if (seenIds.has(event.id)) return false;
  seenIds.add(event.id);
  return true;
});
```

### 2. Add Compact Output Mode

Add an optional `compact` parameter to `get_events`, `get_today`, `get_week_view`, and `search_events` that returns a minimal format:

**Compact format** (default: `true` for get_events, get_today, get_week_view):
```json
{
  "id": "abc123",
  "account": "personal",
  "summary": "Morning Routine",
  "start": "2026-02-25T06:00:00-06:00",
  "end": "2026-02-25T07:05:00-06:00",
  "colorName": "Graphite"
}
```

**Full format** (`compact: false`):
```json
{
  "id": "abc123",
  "account": "personal",
  "calendarName": "Primary",
  "calendarType": "active",
  "summary": "Morning Routine",
  "start": "2026-02-25T06:00:00-06:00",
  "end": "2026-02-25T07:05:00-06:00",
  "colorId": "8",
  "colorName": "Graphite",
  "colorMeaning": "Personal",
  "location": "...",
  "description": "...",
  "status": "confirmed",
  "htmlLink": "..."
}
```

### 3. Add Limit Parameter

Add optional `limit` parameter to cap the number of returned events:

```typescript
inputSchema: {
  properties: {
    // ... existing properties
    limit: {
      type: "number",
      description: "Maximum number of events to return (default: unlimited)",
    },
  },
}
```

### 4. Truncate Long Descriptions (Compact Mode Only)

In compact mode, omit descriptions entirely (title is usually sufficient).

**Escape hatch**: Use `compact: false` to get full event details including complete descriptions when needed (e.g., for events where description contains important details like meeting links, agendas, or instructions).

## Files to Modify

1. `mcp/google-calendar/index.ts`
   - Add `formatEventCompact()` function
   - Add deduplication logic to `fetchEventsFromAllAccounts()`
   - Update tool schemas to include `compact` and `limit` parameters
   - Update tool handlers to use new parameters

## Implementation Details

### New Helper Functions

```typescript
function formatEventCompact(
  event: calendar_v3.Schema$Event,
  account: string
): object {
  return {
    id: event.id,
    account,
    summary: event.summary || "(No title)",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    colorName: event.colorId ? GOOGLE_CALENDAR_COLORS[event.colorId] || "Default" : "Default",
  };
}

function deduplicateEvents(events: any[]): any[] {
  const seen = new Map<string, any>();
  for (const event of events) {
    const existing = seen.get(event.id);
    // Prefer events from primary calendar or where user is owner
    if (!existing || event.calendarName === "Primary") {
      seen.set(event.id, event);
    }
  }
  return Array.from(seen.values());
}
```

### Updated Tool Schemas

Add to `get_events`, `get_today`, `get_week_view`, `search_events`:

```typescript
compact: {
  type: "boolean",
  description: "Return compact event format (fewer fields). Default: true",
  default: true,
},
limit: {
  type: "number",
  description: "Maximum number of events to return",
},
```

## Expected Impact

| Scenario | Before | After (estimate) |
|----------|--------|------------------|
| Single day (42 events) | ~15KB | ~3KB |
| Week view | ~50KB | ~10KB |
| Duplicate events | 42 | ~25 (unique) |

## Testing Plan

1. **Deduplication test**: Verify same event ID only appears once
2. **Compact mode test**: Verify compact output has only essential fields
3. **Full mode test**: Verify `compact: false` still returns all fields
4. **Limit test**: Verify `limit: 10` returns at most 10 events
5. **Backward compatibility**: Ensure existing integrations still work
6. **Description truncation**: Verify long descriptions are truncated in compact mode

## Rollout

1. Implement deduplication (low risk, immediate benefit)
2. Add compact mode with `compact: true` as default
3. Add limit parameter
4. Update skills documentation if needed
