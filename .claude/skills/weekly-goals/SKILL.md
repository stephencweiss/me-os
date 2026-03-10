---
name: weekly-goals
description: Set, review, and track weekly goals from Things 3. Supports auto-detection of progress from calendar events and non-goal anti-pattern alerts.
user-invocable: true
---

# /weekly-goals - Weekly Goal Management

Track weekly objectives with Things 3 as the source of truth. Auto-detects progress from calendar events and alerts when non-goals appear on your calendar.

## Usage

- `/weekly-goals` - Show current week's goals and progress
- `/weekly-goals add` - Quick add a single goal (conversational)
- `/weekly-goals set` - Interactive goal setting (creates in Things 3)
- `/weekly-goals sync` - Pull latest from Things 3
- `/weekly-goals review` - Review progress and match events to goals
- `/weekly-goals non-goals` - Manage anti-patterns to avoid

## Week Identification

Goals use ISO week numbers with tags in Things 3:
- Format: `#wWW-YYYY` (e.g., `#w14-2026` for week 14 of 2026)
- Week starts Monday, ends Sunday
- Tags are lowercase without hash in Things 3 storage

## MCP Tools Used

**Things 3 MCP** (if available):
- `things3.get_weekly_todos` - Get todos by week tag
- `things3.create_weekly_goal` - Generate Things 3 URL to create goal with "week" tag
- `things3.search_todos` - Search by text
- `things3.get_todos_by_tag` - Get todos by tag

**Google Calendar MCP**:
- `google-calendar.get_week_view` - Get events for matching
- `google-calendar.get_events` - Get events for date range
- `google-calendar.create_event` - Block time for goals

## Instructions

### Default Flow (`/weekly-goals`)

Display current week's goals with progress:

1. **Get current week ID**:
   ```typescript
   import { getCurrentWeekId, formatWeekIdForDisplay } from '../../lib/weekly-goals.js';
   const weekId = getCurrentWeekId(); // e.g., "2026-W10"
   ```

2. **Load goals from database**:
   ```typescript
   import { getWeeklyGoalSummaries } from '../../lib/weekly-goals.js';
   const summaries = await getWeeklyGoalSummaries(weekId);
   ```

3. **Load non-goal alerts**:
   ```typescript
   import { getEnrichedAlertsForWeek } from '../../lib/weekly-goals.js';
   const alerts = await getEnrichedAlertsForWeek(weekId);
   ```

4. **Display format**:
   ```
   ## Weekly Goals (2026-W10)
   **Mar 3 - Mar 9**

   ### Active Goals
   | Goal | Type | Progress | Status |
   |------|------|----------|--------|
   | 4h deep work on Project X | time | ████████░░ 80% | ✅ On track |
   | Workout 3x | habit | ██████░░░░ 2/3 | ✅ On track |
   | Finish spec document | outcome | ░░░░░░░░░░ 0% | ⚠️ At risk |

   ### Non-Goal Alerts
   ⚠️ 2 events matched non-goals:
   - "Excessive meetings" matched "Team sync #5" (Wed 2pm)
   ```

5. **Offer actions**:
   - `[1] Match unassigned events` - Run event matching
   - `[2] Mark goal complete` - Update status
   - `[3] Add new goal` - Create in Things 3
   - `[4] Sync from Things 3` - Pull latest

### Add Flow (`/weekly-goals add`)

Quick conversational goal creation:

1. **Parse user intent** from their message:
   ```
   User: "Add a goal for this week: 4 hours of deep work"

   Parsed:
   - title: "4 hours of deep work"
   - goalType: "time" (inferred from "4 hours")
   - estimatedMinutes: 240
   - weekId: current week (e.g., "2026-W10")
   ```

2. **Confirm with user**:
   ```
   Creating time goal for 2026-W10:
   - "4 hours of deep work"
   - Estimate: 4h

   Create and sync to Things 3? [Y/n]
   ```

3. **Create in database via API**:
   ```bash
   # POST to the webapp API
   curl -X POST http://localhost:3001/api/goals \
     -H "Content-Type: application/json" \
     -d '{
       "weekId": "2026-W10",
       "title": "4 hours of deep work",
       "goalType": "time",
       "estimatedMinutes": 240,
       "syncToThings3": true
     }'
   ```

4. **Open Things 3 URL** (from API response):
   ```bash
   # API returns things3Url when syncToThings3 is true
   open "things:///add?title=4+hours+of+deep+work&tags=week&deadline=2026-03-08&when=this+week"
   ```

5. **Confirm success**:
   ```
   ✅ Goal created!
   - Added to MeOS database
   - Things 3 opened to create matching todo

   Tip: The goal will sync back from Things 3 on next `/weekly-goals sync`.
   ```

**Alternative: Use MCP tool directly**:
```typescript
// Use things3 MCP create_weekly_goal tool
const result = await things3.create_weekly_goal({
  title: "4 hours of deep work",
  weekId: "2026-W10",
  notes: "Focus on Project X",
  estimatedMinutes: 240,
});
// Open the returned URL
await shell.open(result.url);
```

**Example conversations**:

```
User: Add a goal for this week: finish the API spec
Claude: Creating outcome goal for 2026-W10:
        - "Finish the API spec"
        Create and sync to Things 3? [Y/n]
User: y
Claude: ✅ Done! Goal created in MeOS and Things 3.
```

```
User: /weekly-goals add workout 3x this week
Claude: Creating habit goal for 2026-W10:
        - "Workout 3x this week"
        - Type: habit
        Create and sync to Things 3? [Y/n]
User: yes
Claude: ✅ Goal created!
```

### Set Flow (`/weekly-goals set`)

Create new goals interactively:

1. **Ask for goals**:
   ```
   What do you want to accomplish this week?

   Examples:
   - "4 hours of deep work on Project X"
   - "Workout 3x this week"
   - "Finish the spec document by Friday"
   ```

2. **Parse goal type and duration**:
   ```typescript
   import { inferGoalType, parseEstimatedMinutes } from '../../lib/weekly-goals.js';
   const type = inferGoalType(input); // 'time' | 'outcome' | 'habit'
   const minutes = parseEstimatedMinutes(input); // e.g., 240 for "4 hours"
   ```

3. **Create in Things 3** (via MCP or URL):
   ```typescript
   import { generateCreateGoalUrl, weekIdToThingsTag } from '../../lib/things3-sync.js';
   const url = generateCreateGoalUrl(title, weekId, { notes, deadline });
   // Or use things3 MCP: create-things3-todo with tags: [weekIdToThingsTag(weekId)]
   ```

4. **Save to local database**:
   ```typescript
   import { upsertWeeklyGoal } from '../../lib/calendar-db.js';
   await upsertWeeklyGoal({
     things3_id: generatedId,
     week_id: weekId,
     title,
     notes,
     estimated_minutes: minutes,
     goal_type: type,
     color_id: null,
     status: 'active',
     progress_percent: 0,
     completed_at: null,
   });
   ```

### Sync Flow (`/weekly-goals sync`)

Pull goals from Things 3:

1. **Search Things 3 for week tag**:
   ```typescript
   import { weekIdToThingsTag } from '../../lib/things3-sync.js';
   const tag = weekIdToThingsTag(weekId); // e.g., "w10-2026"
   // Use things3 MCP: search-things3-todos with query: `#${tag}`
   ```

2. **Sync to database**:
   ```typescript
   import { syncGoalsFromThings3, formatSyncResult } from '../../lib/things3-sync.js';
   const result = await syncGoalsFromThings3(todos, weekId);
   console.log(formatSyncResult(result));
   ```

3. **Report changes**:
   ```
   ## Sync Complete
   - Created: 2 new goals
   - Updated: 1 goal
   - Completed: 0 goals marked done
   - Unchanged: 3 goals
   ```

### Review Flow (`/weekly-goals review`)

Match calendar events to goals:

1. **Load week's events**:
   ```typescript
   import { getWeekDateRange } from '../../lib/weekly-goals.js';
   import { getEventsForDateRange } from '../../lib/calendar-db.js';
   const { start, end } = getWeekDateRange(weekId);
   const events = await getEventsForDateRange(start, end);
   ```

2. **Run auto-matching**:
   ```typescript
   import { processBatchMatches, formatMatchResultsForDisplay } from '../../lib/goal-matcher.js';
   const goals = await getGoalsForWeek(weekId);
   const result = processBatchMatches(events, goals);
   ```

3. **Handle auto-matches**:
   ```typescript
   import { recordGoalProgress, recalculateGoalProgress } from '../../lib/weekly-goals.js';
   for (const match of result.autoMatches) {
     const event = events.find(e => e.id === match.eventId);
     await recordGoalProgress({
       goal_id: match.goalId,
       event_id: match.eventId,
       matched_at: new Date().toISOString(),
       match_type: 'auto',
       match_confidence: match.confidence,
       minutes_contributed: event.duration_minutes,
     });
     await recalculateGoalProgress(match.goalId);
   }
   ```

4. **Prompt for ambiguous matches**:
   ```typescript
   import { generateMatchPrompt } from '../../lib/goal-matcher.js';
   for (const match of result.needsConfirmation) {
     const event = events.find(e => e.id === match.eventId);
     const candidates = goals.filter(g => /* relevant goals */);
     console.log(generateMatchPrompt(event, candidates));
     // Get user input and record if confirmed
   }
   ```

5. **Run non-goal detection**:
   ```typescript
   import { runNonGoalDetectionForWeek } from '../../lib/weekly-goals.js';
   const alerts = await runNonGoalDetectionForWeek(weekId);
   if (alerts.length > 0) {
     console.log(`⚠️ Found ${alerts.length} events matching non-goals`);
   }
   ```

### Non-Goals Flow (`/weekly-goals non-goals`)

Manage anti-patterns:

1. **List existing non-goals**:
   ```typescript
   import { getNonGoalsForWeek } from '../../lib/calendar-db.js';
   const nonGoals = await getNonGoalsForWeek(weekId);
   ```

2. **Add new non-goal**:
   ```typescript
   import { createNonGoal } from '../../lib/calendar-db.js';
   await createNonGoal({
     week_id: weekId,
     title: "Excessive meetings",
     pattern: "sync|standup|check-in",
     color_id: null,
     reason: "Leaves no time for deep work",
     active: 1,
   });
   ```

3. **Test pattern against recent events**:
   ```typescript
   const testEvents = await getEventsForDateRange(start, end);
   const pattern = new RegExp(nonGoal.pattern, 'i');
   const matches = testEvents.filter(e => pattern.test(e.summary));
   console.log(`Pattern would match ${matches.length} events`);
   ```

## Integration with /calendar-optimizer

The optimizer automatically includes weekly goals when allocating time:

```typescript
import { getGoalsForOptimizer } from '../../lib/weekly-goals.js';

// In optimizer, load weekly goals alongside recurring goals
const weeklyGoals = await getGoalsForOptimizer(getCurrentWeekId());
// These are TimeGoal-compatible objects with remaining minutes calculated
```

To disable weekly goals in a specific optimization run:
```
/calendar-optimizer --no-weekly-goals
```

## Progress Bar Rendering

Use this helper to render visual progress:

```typescript
function renderProgressBar(percent: number, width: number = 10): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Example: renderProgressBar(75) => "████████░░"
```

## Color Assignment

Goals can be assigned colors matching the calendar color schema:
- Suggest color based on goal type (time → Sage, habit → Graphite)
- Allow user override
- Use color for event matching confidence boost

## Error Handling

- If Things 3 MCP is unavailable, fall back to URL scheme
- If database is empty, prompt user to sync first
- If no goals found, suggest creating some
