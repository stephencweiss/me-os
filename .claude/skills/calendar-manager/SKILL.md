---
name: calendar-manager
description: Active calendar management - detect conflicts, categorize events, fill gaps with flex time. Works across all authenticated accounts.
user-invocable: true
---

# /calendar-manager - Active Calendar Management

Actively manage your calendar: detect double bookings, categorize unlabeled events, and fill gaps with flex time blocks.

## Usage

**Default (dashboard + interactive):**
- `/calendar-manager` - Today's overview with interactive prompts for all features
- `/calendar-manager yesterday` - Yesterday's analysis
- `/calendar-manager tomorrow` - Tomorrow's preparation
- `/calendar-manager week` - This week's overview

**Targeted commands (run only that feature):**
- `/calendar-manager conflicts` - Only resolve double bookings
- `/calendar-manager categorize` - Only label unlabeled events
- `/calendar-manager flex` - Only fill gaps with flex events

## Features

### 1. Conflict Detection
Identifies overlapping events across all calendars.

**Process:**
1. Fetch events from all accounts (personal + work)
2. Use sweep-line algorithm to find all overlapping groups
3. For each conflict group:
   - Show all overlapping events with times, colors, accounts
   - Suggest which events to attend (non-overlapping subset)
   - Ask user which to attend
4. If user picks overlapping events:
   - Calculate split time (evenly divided)
   - Confirm allocation
5. Decline non-attended events via `update_event_status` MCP tool
6. Save decisions to `data/calendar-decisions/YYYY-MM-DD.json`

### 2. Event Categorization
Labels events that have no color assigned.

**Process:**
1. Find all events with "Default" or no color
2. For each unlabeled event, suggest category based on title:
   - "1:1 with Alice" → Lavender (1:1s / People)
   - "Team standup" → Grape (Meetings)
   - "Focus time" → Sage (Deep Work)
   - "External vendor call" → Tangerine (External)
3. Ask user to confirm or change suggested label
4. Update via `update_event_color` MCP tool
5. For recurring events, update the entire series (strip date suffix from ID)

### 3. Flex Time Blocking
Creates "flex" events in gaps during waking hours.

**Configuration** (from `config/calendar-manager.json`):
- Waking hours: 6am-10pm
- Minimum gap: 30 minutes
- Skip weekends: Yes
- Create on: Both calendars (personal + work)

**Process:**
1. Calculate gaps using `calculateFlexSlots()`
2. Show gaps with durations
3. Ask: "Create flex events? [all/select/none]"
4. Create events via `create_event` MCP tool:
   - Title: "flex"
   - Color: Blueberry (9)
   - Visibility: Private

## Color Schema

See `config/colors.json` for the shared color definitions used across all calendar skills.

Use `get_color_definitions` MCP tool to retrieve color meanings programmatically.

## Instructions for Claude

When the user invokes this skill:

### For `/calendar-manager` (default dashboard):

1. **Fetch today's events** using `get_today` MCP tool
2. **Show overview:**
   - Total events, total scheduled time
   - Events by category (color)
   - Any conflicts detected
   - Any unlabeled events
   - Gap time available
3. **Offer interactive options:**
   ```
   I found:
   - 2 conflict groups (4 overlapping events)
   - 3 unlabeled events
   - 2h 30m of gap time

   What would you like to do?
   1. Resolve conflicts
   2. Categorize unlabeled events
   3. Create flex events
   4. All of the above
   ```

### For `/calendar-manager conflicts`:

1. Fetch events for the time range
2. Call `buildOverlapGroups()` from `lib/calendar-manager.ts`
3. For each group with conflicts:
   - Display events with times and accounts
   - Suggest non-overlapping subset
   - Ask user which to attend
4. Process declining non-attended events
5. Record decisions

### For `/calendar-manager categorize`:

1. Fetch events for the time range
2. Call `findUnlabeledEvents()` from `lib/calendar-manager.ts`
3. For each unlabeled event:
   - Call `suggestCategory()` for suggestion
   - Present suggestion with confidence
   - Ask user to confirm or change
4. Update colors via MCP tool

### For `/calendar-manager flex`:

1. Fetch events for the time range
2. Load config from `config/calendar-manager.json`
3. Call `calculateFlexSlots()` with config
4. Show gaps and durations
5. Ask user preference (all/select/none)
6. Create events on both calendars via `create_event` MCP tool

## Recurring Events

When updating recurring events:
1. Check if event ID contains date suffix pattern (`_YYYYMMDDTHHMMSSZ`)
2. If recurring, ask: "Update this instance or entire series?"
3. For series: use `extractRecurringParentId()` to get parent ID
4. Default to series update

## Data Storage

Conflict decisions are stored in `data/calendar-decisions/`:
```json
{
  "date": "2026-02-23",
  "conflicts": [
    {
      "groupId": "overlap-0",
      "events": ["event1", "event2"],
      "attending": ["event1"],
      "declined": ["event2"],
      "splitAllocation": { "event1": 30 }
    }
  ]
}
```

## Prerequisites

- Google Calendar MCP server configured
- Both personal and work accounts authenticated
- `config/calendar-manager.json` exists
- `data/calendar-decisions/` directory exists
