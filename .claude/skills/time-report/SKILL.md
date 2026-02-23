---
name: time-report
description: Generate time analysis reports showing how you spent your week, with gap detection and category breakdowns. Shows data from all authenticated Google accounts.
user-invocable: true
---

# /time-report - Time Analysis & Weekly Reports

Analyze how you spend your time based on calendar data. Identifies scheduled vs. unstructured time, groups events by color category, and shows patterns.

## Usage

- `/time-report` - This week's summary
- `/time-report yesterday` - Yesterday's breakdown (best for gap categorization)
- `/time-report today` - Today's breakdown
- `/time-report week <date>` - Specific week (e.g., `/time-report week 2024-01-15`)
- `/time-report gaps` - Focus on unstructured time analysis

## What It Shows

### Time by Category
Events grouped by their calendar color with semantic meanings:

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
| Tomato | Urgent / Deadlines |

### Gap Analysis
Unstructured time during work hours (9am-6pm):
- Time blocks without scheduled events
- Identifies your "available" time
- Useful for finding focus time

### Multi-Account Support
Shows combined data from all authenticated calendars (personal + work) with account labels on each event.

## Instructions

When the user invokes this skill:

1. **For `/time-report` (no args or "week")**:
   - Run the standalone script: `node --loader ts-node/esm scripts/weekly-report.ts`
   - Present the markdown output to the user
   - Highlight key insights (busiest day, most time in which category, total gap time)

2. **For `/time-report yesterday`**:
   - Run: `node --loader ts-node/esm scripts/weekly-report.ts --yesterday`
   - Show the daily breakdown
   - **Important**: After showing the report, run the interactive features (see below)

3. **For `/time-report today`**:
   - Run: `node --loader ts-node/esm scripts/weekly-report.ts --today`
   - Show what's planned and remaining gaps

4. **For `/time-report week <date>`**:
   - Run: `node --loader ts-node/esm scripts/weekly-report.ts --week <date>`
   - The date should be in YYYY-MM-DD format

5. **For `/time-report gaps`**:
   - Run the weekly report and focus on the "Unstructured Time" section
   - Analyze patterns: Which days have most gaps? What times?

## Interactive Features

After showing the report (especially for `/time-report yesterday`), offer these interactive features:

### 1. Label Unlabeled Events

**What:** Events that exist but have "Default" color (no category assigned).

**Process:**
1. Identify all events with colorId "default" or no color
2. For each unlabeled event, suggest a category based on the event title:
   - "1:1 with Alice" → suggest Lavender (1:1s / People)
   - "Team standup" → suggest Grape (Meetings)
   - "Focus time" → suggest Sage (Deep Work)
3. Ask user: "I found these unlabeled events. Confirm or change the suggested labels:"
   - `[9:00 AM] Team standup → Grape (Meetings)? [y/change]`
4. If user confirms, use the `update_event_color` MCP tool to update the color
5. If user says "change", ask them which color to use

**Handling Recurring Events:**

Recurring events have instance IDs with a date suffix (e.g., `abc123_20260222T130000Z`).
When updating a recurring event:

1. **Detect if recurring:** Check if the event ID contains an underscore followed by a date pattern
2. **Ask user:** "This is a recurring event. Update just this instance, or the entire series?"
3. **For single instance:** Use the full ID with date suffix
4. **For entire series:** Strip the date suffix to get the parent event ID:
   - Instance: `sa8vq84c1lf1g1cr653erfp7m4_20260222T130000Z`
   - Series: `sa8vq84c1lf1g1cr653erfp7m4`
5. **Default to series:** Most users expect color changes to apply to all occurrences

### 2. Categorize Gap Time

**What:** Time blocks with NO events - unstructured/unscheduled time.

**Process:**
1. Show each significant gap (30+ minutes) from the report
2. Ask user: "What did you do during this time?"
   - Example: "Monday 9:00 AM - 10:30 AM (1h 30m) - What did you do?"
3. User provides breakdown:
   - "45 min deep work on project X, 30 min emails, 15 min coffee break"
4. Record this breakdown (store in `data/time-tracking/YYYY-MM-DD.json`)
5. Include in future reports as "Retrospective Categorization"

**Note:** This is most useful with `/time-report yesterday` when memory is fresh.

### 3. Week Comparison

When user asks, compare current week to previous:
- Run report for both weeks
- Show delta: "This week you had 2h more meetings and 1h less focus time"

## Data Storage

Gap categorization data is stored locally:
```
data/time-tracking/
├── 2024-01-15.json
├── 2024-01-16.json
└── ...
```

Format:
```json
{
  "date": "2024-01-15",
  "gaps": [
    {
      "start": "09:00",
      "end": "10:30",
      "breakdown": [
        { "category": "Deep Work", "minutes": 45, "note": "Project X" },
        { "category": "Admin", "minutes": 30, "note": "Emails" },
        { "category": "Break", "minutes": 15 }
      ]
    }
  ]
}
```

## Example Output

```
# Yesterday's Time Report
**Monday, February 16, 2026**

## Summary
- **Total Scheduled:** 6h 15m
- **Unstructured Time (9am-6pm):** 2h 45m
- **Event Count:** 8

## Time by Category
| Category | Color | Time | Events |
|----------|-------|------|--------|
| Meetings | Grape | 3h 00m | 4 |
| 1:1s / People | Lavender | 1h 30m | 3 |
| (Unlabeled) | Default | 1h 45m | 1 |

## Events
- 9:30 AM - 10:00 AM: Team standup [work] [Grape - Meetings]
- 10:00 AM - 11:00 AM: Project review [work] [Default]  ← UNLABELED
...

## Unstructured Time Blocks
- 9:00 AM - 9:30 AM (30m)
- 2:00 PM - 3:30 PM (1h 30m)
- 5:00 PM - 6:00 PM (1h)

---

## Interactive: Label Unlabeled Events

I found 1 event without a category:
- **10:00 AM: Project review** → I suggest: **Grape (Meetings)**
  Confirm? [y/n/other color]

## Interactive: Categorize Gap Time

You had 2h 45m of unscheduled time yesterday. Let's categorize it:

**2:00 PM - 3:30 PM (1h 30m)** - What did you do during this time?
```

## Prerequisites

- Google Calendar MCP server must be configured and authenticated
- Both personal and work accounts should be authenticated for complete view
- Create `data/time-tracking/` directory for gap categorization storage
