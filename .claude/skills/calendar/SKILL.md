---
name: calendar
description: View and manage your Google Calendar. Use for week-at-a-glance views, event color management, and schedule queries.
---

# /calendar - Calendar View and Management

View your Google Calendar and manage event colors with semantic meaning.

## Usage

- `/calendar` - Show this week's events grouped by day with colors
- `/calendar today` - Show today's schedule
- `/calendar color "<event>" <color>` - Change an event's color

## Available Colors

| Color | Meaning |
|-------|---------|
| Lavender | 1:1s / People |
| Sage | Deep Work / Focus |
| Grape | Meetings |
| Flamingo | Blocked / Waiting |
| Banana | Admin / Ops |
| Tangerine | External |
| Peacock | Learning |
| Graphite | Personal |
| Blueberry | Unassigned |
| Basil | Unassigned |
| Tomato | Urgent / Deadlines |

## Instructions

When the user invokes this skill:

1. **For `/calendar` (no args or "week")**:
   - Use the `get_week_view` tool from the google-calendar MCP server
   - Display events grouped by day
   - Show each event with: time, title, and color (with semantic meaning)
   - Format times in a readable way (e.g., "9:00 AM - 10:00 AM")

2. **For `/calendar today`**:
   - Use the `get_today` tool
   - Show today's events in chronological order
   - Include color meanings

3. **For `/calendar color "<event>" <color>`**:
   - First use `search_events` to find the event by name
   - If multiple matches, ask the user to clarify which one
   - Use `update_event_color` to change the color
   - Confirm the change was successful

## Example Output

```
Week of Feb 17, 2025

**Monday, Feb 17**
- 9:00 AM - 10:00 AM: Team Standup [Grape - Meetings]
- 2:00 PM - 3:00 PM: 1:1 with Alice [Lavender - 1:1s]

**Tuesday, Feb 18**
- 10:00 AM - 12:00 PM: Deep Work Block [Sage - Focus]
- 3:00 PM - 4:00 PM: External Partner Call [Tangerine - External]

**Wednesday, Feb 19**
(No events)

...
```

## Prerequisites

- Google Calendar MCP server must be configured and authenticated
- Run `npm run auth` first if you haven't authenticated yet
