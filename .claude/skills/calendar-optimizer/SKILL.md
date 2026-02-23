---
name: calendar-optimizer
description: Goal-based calendar optimization to help achieve weekly objectives. Proposes schedule changes with user approval before creating events.
user-invocable: true
---

# /calendar-optimizer - Goal-Based Calendar Optimization

Helps you achieve your weekly objectives by analyzing your schedule, finding available time slots, and creating events with your approval.

## Usage

- `/calendar-optimizer` - Analyze week with recurring goals
- `/calendar-optimizer <goals text>` - Add ad-hoc goals for this session
- `/calendar-optimizer status` - Show goal progress vs. schedule
- `/calendar-optimizer apply` - Apply last proposed changes
- `/calendar-optimizer add-goal` - Interactive wizard to add a recurring goal
- `/calendar-optimizer goals` - List/edit/remove recurring goals

## Goal Types

### Time Goals
Goals with specific time commitments:
- "4 hours of dedicated writing time (1-2 hour sessions)"
- "workout 3x this week, 45 min each"
- "2h focus time in the morning"

### Outcome Goals
Goals with deliverables:
- "Focus on Project X to achieve milestone Y"

## How It Works

1. **Load Goals**: Recurring goals from `config/optimization-goals.json` + any ad-hoc goals you specify
2. **Analyze Schedule**: Fetch events for current week, identify gaps and existing goal time
3. **Optimize**: Allocate time slots respecting session constraints and time preferences
4. **Propose**: Show proposed events and optional moves for your approval
5. **Apply**: Create events via Google Calendar API after confirmation

## Instructions

### Default Flow (`/calendar-optimizer`)

1. Load recurring goals from `config/optimization-goals.json`:
   ```typescript
   import { loadRecurringGoals } from "../../lib/calendar-optimizer.js";
   const goals = loadRecurringGoals("config/optimization-goals.json");
   ```

2. Ask: "Any additional goals for this week?" (conversational input)

3. Fetch events for current week using `get_week_view` MCP tool

4. Calculate available gaps using `calculateFlexSlots()` from `lib/calendar-manager.ts`

5. Run slot allocation:
   ```typescript
   import { findSlotsForGoal, scoreOptimization } from "../../lib/calendar-optimizer.js";
   for (const goal of goals) {
     const proposed = findSlotsForGoal(goal, availableGaps);
     // Remove allocated slots from availableGaps
   }
   ```

6. Display proposed schedule:
   ```
   ## Calendar Optimization Analysis

   **Current week (Feb 24 - Mar 2):**
   - Scheduled time: 32h
   - Available gaps: 18h (during waking hours 6am-10pm)

   **Your Goals:**
   1. Writing time: 4h needed (2-4 sessions of 1-2h)
   2. Workouts: 2h 15m needed (3 x 45 min)

   **Proposed Schedule:**

   | Goal | Slot | Duration | Action |
   |------|------|----------|--------|
   | Writing | Mon 7:00-9:00 AM | 2h | Create event |
   | Workout | Mon 6:00-6:45 PM | 45m | Create event |
   | Writing | Wed 7:00-9:00 AM | 2h | Create event |

   Proceed with these changes? [all/select/none]
   ```

7. If approved, create events using `create_event` MCP tool for each proposed event

### Status Flow (`/calendar-optimizer status`)

1. Load goals from config
2. Fetch current week events
3. Match events to goals by colorId
4. Show progress:
   ```
   ## Goal Progress
   - Writing: 2h / 4h (50%)
   - Workout: 1 / 3 sessions (33%)
   ```

### Add Goal Flow (`/calendar-optimizer add-goal`)

Interactive wizard:
1. "What's the name of this goal?" - e.g., "Writing time"
2. "How much time per week?" - e.g., "4 hours"
3. "Session length constraints?" - Options: [No constraint / Min only / Max only / Min and Max]
4. "Preferred time of day?" - Options: [Morning / Afternoon / Evening / No preference]
5. "Which calendar color?" - Show color options with meanings from `config/colors.json`
6. "Priority relative to other goals?" - Show existing goals

Save using:
```typescript
import { saveRecurringGoal } from "../../lib/calendar-optimizer.js";
saveRecurringGoal(newGoal, "config/optimization-goals.json");
```

### Goals Management (`/calendar-optimizer goals`)

1. Load and display:
   ```
   ## Recurring Goals
   | # | Name | Weekly | Sessions | Color | Priority |
   |---|------|--------|----------|-------|----------|
   | 1 | Writing time | 4h | 1-2h each | Sage | 1 |
   | 2 | Workout | 2h 15m | 45m x 3 | Graphite | 2 |
   ```

2. Ask: "What would you like to do?" [Edit / Remove / Reorder / Done]

3. Handle edits using `saveRecurringGoal()` or `removeRecurringGoal()`

## Key Functions

From `lib/calendar-optimizer.ts`:
- `parseGoalsFromText(text)` - Parse natural language goals
- `loadRecurringGoals(path)` - Load goals from config
- `saveRecurringGoal(goal, path)` - Save a recurring goal
- `removeRecurringGoal(id, path)` - Remove a goal
- `findSlotsForGoal(goal, gaps)` - Allocate time slots
- `identifyMovableEvents(events, patterns)` - Find events that can be moved
- `scoreOptimization(goals, proposed)` - Score optimization quality

From `lib/calendar-manager.ts`:
- `calculateFlexSlots(events, config)` - Find available time gaps

## MCP Tools

- `get_week_view` - Fetch current week's events
- `create_event` - Create new calendar events
- `update_event_time` - Move/reschedule events
- `delete_event` - Remove events

## Color Reference

See `config/colors.json` for semantic color definitions. Common assignments:
- Sage (2) - Deep Work / Focus
- Graphite (8) - Personal
- Blueberry (9) - Flex / Blocked time

## Configuration

Goals config: `config/optimization-goals.json`
```json
{
  "recurringGoals": [...],
  "constraints": {
    "noMeetingsBefore": 9,
    "maxMeetingsPerDay": 5,
    "preferContiguousFocus": true,
    "minFocusBlockMinutes": 90
  },
  "movableEventPatterns": ["sync", "1:1", "check-in"]
}
```

## Prerequisites

- Google Calendar MCP server configured and authenticated
- `config/optimization-goals.json` exists (will be created on first goal add)
- `lib/calendar-optimizer.ts` available
