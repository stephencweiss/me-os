# MeOS Implementation Plan

## Overview
Build a personal productivity system as Claude Code skills with MCP integration. TypeScript/Node.js stack, Google Calendar as primary calendar provider.

## Phase 1: Foundation & Google Calendar Integration

### 1.1 Project Setup
- Initialize npm project with TypeScript
- Set up directory structure: `skills/`, `mcp/`, `scripts/`, `lib/`, `config/`
- Configure TypeScript, ESLint, gitignore (credentials)
- Add base dependencies: `@modelcontextprotocol/sdk`, `googleapis`

### 1.2 Google Calendar API Setup
- Create Google Cloud project
- Enable Calendar API
- Set up OAuth2 credentials (desktop app flow)
- Create auth helper in `lib/google-auth.ts` for token management
- Store credentials in `config/` (gitignored)

### 1.3 Google Calendar MCP Server
**Location**: `mcp/google-calendar/`

Tools to implement:
- `list_calendars` - Get all calendars for the user
- `get_events` - Get events for a date range
- `get_week_view` - Week-at-a-glance with color info
- `update_event_color` - Change an event's color
- `get_color_definitions` - List available calendar colors and their IDs

Resources:
- `calendar://week` - Current week's events
- `calendar://today` - Today's events

### 1.4 Calendar Skill
**Location**: `skills/calendar/`

Skill file: `skills/calendar/skill.md`
- `/calendar` - Show week view with color coding
- `/calendar today` - Today's schedule
- `/calendar color <event> <color>` - Change event color

### 1.5 Testing Strategy - Phase 1

**How we prove it works:**
1. OAuth flow completes and tokens are stored/refreshed correctly
2. MCP server starts and registers tools with Claude Code
3. Calendar data matches what's visible in Google Calendar web UI
4. Color changes persist in Google Calendar

**Tests to run:**

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Auth flow | `npx ts-node lib/google-auth.ts` | Browser opens, consent granted, tokens saved to `config/tokens.json` |
| Token refresh | Delete `tokens.json`, re-run auth | New tokens generated without re-consent (if refresh token valid) |
| MCP server startup | `npx ts-node mcp/google-calendar/index.ts` | Server starts, no errors, logs "MCP server ready" |
| List calendars | Call `list_calendars` via Claude | Returns array of calendars matching Google Calendar UI |
| Get events | Call `get_events` for today | Returns events matching today's schedule in Google Calendar |
| Week view | `/calendar` skill | Displays current week with events, colors shown |
| Color change | `/calendar color "Meeting" Sage` | Event color changes, verify in Google Calendar web UI |
| Error handling | Request events with invalid date range | Graceful error message, no crash |

**Verification checklist:**
- [ ] Create a test event in Google Calendar with a known color
- [ ] Verify `/calendar` shows that event with correct color
- [ ] Change the color via `/calendar color`
- [ ] Refresh Google Calendar web UI to confirm color changed
- [ ] Delete the test event

---

## Phase 2: Time Reports & Analytics

### 2.1 Time Analysis Library
**Location**: `lib/time-analysis.ts`

Functions:
- `calculateGaps(events, dayStart, dayEnd)` - Find unscheduled time
- `groupByColor(events)` - Aggregate time by color/category
- `generateDailySummary(date)` - Stats for a single day
- `generateWeeklyReport(startDate)` - Full week analysis

### 2.2 Time Report Skill
**Location**: `skills/time-report/`

Skill file: `skills/time-report/skill.md`
- `/time-report` - This week's summary
- `/time-report week <date>` - Specific week analysis
- `/time-report yesterday` - Yesterday's breakdown
- `/time-report gaps` - Focus on unstructured time

Interactive features:
- Prompt to assign colors to unlabeled events
- Show comparison to previous weeks

### 2.3 Standalone Script
**Location**: `scripts/weekly-report.ts`

CLI script that generates weekly report without LLM:
```bash
npx ts-node scripts/weekly-report.ts [--week 2024-01-15]
```
Outputs markdown summary, can be invoked by skill.

### 2.4 Testing Strategy - Phase 2

**How we prove it works:**
1. Gap calculation correctly identifies unscheduled time
2. Time aggregation by color matches manual calculation
3. Weekly report totals are accurate
4. Standalone script produces same results as skill

**Tests to run:**

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Gap calculation | Create day with 9am-10am and 2pm-3pm events | Reports gaps: before 9am, 10am-2pm, after 3pm |
| Color grouping | Week with mixed color events | Totals per color match manual count |
| Daily summary | `/time-report yesterday` | Hours per category + gap time = 24h (or work day) |
| Weekly report | `/time-report` | Shows all 7 days, totals match sum of dailies |
| Script parity | `npx ts-node scripts/weekly-report.ts` | Output matches `/time-report` for same week |
| Edge case: no events | Query empty day | Reports 100% unstructured time |
| Edge case: overlapping | Two events at same time | Handles gracefully (no double-counting) |

**Verification checklist:**
- [ ] Run report for a known week, manually verify totals
- [ ] Compare script output to skill output for same date range
- [ ] Test with a day that has no events
- [ ] Test with back-to-back events (no gaps)

---

## Phase 3: One-on-One Management

### 3.1 Voice Transcription
**Location**: `lib/transcription.ts`

- Use Claude's audio capabilities or Whisper API
- Accept audio file path, return transcript
- Store raw audio in `data/audio/` (gitignored)

### 3.2 One-on-One Skill
**Location**: `skills/one-on-one/`

Skill file: `skills/one-on-one/skill.md`
- `/one-on-one <name>` - Start 1:1 session
- `/one-on-one <name> transcribe <audio-path>` - Process voice notes
- `/one-on-one <name> summary` - Generate summary from recent notes
- `/one-on-one <name> history` - View past 1:1s

Data storage: `data/one-on-ones/<name>/`
- `YYYY-MM-DD-raw.md` - Raw transcript
- `YYYY-MM-DD-summary.md` - Structured summary

### 3.3 Export Integrations (Future)
- Google Docs API for document creation
- Lattice API for feedback submission (requires Lattice API access)

### 3.4 Testing Strategy - Phase 3

**How we prove it works:**
1. Audio transcription produces readable, accurate text
2. Raw notes are stored correctly per person
3. Summaries capture key points from raw notes
4. History retrieval shows correct chronological order

**Tests to run:**

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| Transcription | `/one-on-one Alice transcribe test.m4a` | Produces readable transcript of audio content |
| Storage | Check `data/one-on-ones/Alice/` | Raw file created with date prefix |
| Summary generation | `/one-on-one Alice summary` | Produces structured summary with action items |
| History | `/one-on-one Alice history` | Shows past entries in reverse chronological order |
| New person | `/one-on-one NewPerson` | Creates new directory, starts fresh |
| Multiple entries | Add 3 entries for same person | All stored separately, history shows all 3 |

**Verification checklist:**
- [ ] Record a short test audio (30 seconds)
- [ ] Transcribe and verify accuracy against what was said
- [ ] Generate summary and confirm it captures main points
- [ ] Check file system to verify data structure
- [ ] Retrieve history and confirm ordering

---

## Phase 4: Project Dashboard

### 4.1 JIRA Integration
Leverage existing JIRA MCP from work environment.

### 4.2 Project Dashboard Skill
**Location**: `skills/project-dash/`

- `/project-dash` - Overview of active projects
- `/project-dash <project>` - Deep dive on specific project
- `/project-dash changes` - Recent ticket status changes

### 4.3 Testing Strategy - Phase 4

**How we prove it works:**
1. JIRA MCP connection works and returns project data
2. Project overview shows accurate ticket counts/statuses
3. Status changes are detected correctly
4. Skill presents data in useful, scannable format

**Tests to run:**

| Test | Command/Action | Expected Result |
|------|----------------|-----------------|
| MCP connection | Verify JIRA MCP is configured | MCP tools available in Claude Code |
| Project list | `/project-dash` | Shows active projects with status summary |
| Project detail | `/project-dash PROJ-123` | Shows tickets, blockers, recent activity |
| Status changes | `/project-dash changes` | Lists tickets that changed status recently |
| Error handling | Query non-existent project | Graceful "project not found" message |

**Verification checklist:**
- [ ] Verify JIRA MCP is accessible from Claude Code
- [ ] Query a known project and compare to JIRA web UI
- [ ] Move a ticket in JIRA, verify it appears in "changes"
- [ ] Test with a project you have no access to (permissions)

---

## Color Schema Definition
**Location**: `config/colors.json`

```json
{
  "1": { "name": "Lavender", "meaning": "1:1s / People" },
  "2": { "name": "Sage", "meaning": "Deep Work / Focus" },
  "3": { "name": "Grape", "meaning": "Meetings" },
  "4": { "name": "Flamingo", "meaning": "Blocked / Waiting" },
  "5": { "name": "Banana", "meaning": "Admin / Ops" },
  "6": { "name": "Tangerine", "meaning": "External" },
  "7": { "name": "Peacock", "meaning": "Learning" },
  "8": { "name": "Graphite", "meaning": "Personal" }
}
```
(User to customize)

---

## Files to Create

### Phase 1
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `lib/google-auth.ts`
- `mcp/google-calendar/index.ts`
- `mcp/google-calendar/package.json`
- `skills/calendar/skill.md`
- `config/colors.json`

### Phase 2
- `lib/time-analysis.ts`
- `skills/time-report/skill.md`
- `scripts/weekly-report.ts`

### Phase 3
- `lib/transcription.ts`
- `skills/one-on-one/skill.md`
- `data/` directory structure

### Phase 4
- `skills/project-dash/skill.md`

---

## Immediate Next Steps
1. Initialize the project (`npm init`, tsconfig, dependencies)
2. Set up Google Cloud project and Calendar API credentials
3. Build the Google Calendar MCP server
4. Create the `/calendar` skill
5. Test end-to-end: invoke skill → MCP → Google Calendar → display

---

## Workflow

**After each successful step:**
1. Update this plan with a change log entry documenting progress
2. Commit the changes with a descriptive message

---

## Change Log

| Date | Step | Status | Notes |
|------|------|--------|-------|
| 2026-02-20 | Initial planning | Complete | Created CLAUDE.md, IDEA.md, and implementation plan |
| 2026-02-20 | Phase 1.1: Project setup | Complete | package.json, tsconfig.json, .npmrc (public registry), .gitignore |
| 2026-02-20 | Phase 1.2: Directory structure | Complete | Created lib/, mcp/, scripts/, skills/, config/, data/ |
| 2026-02-20 | Phase 1.3: Google auth helper | Complete | lib/google-auth.ts - OAuth2 flow for Google Calendar |
| 2026-02-20 | Phase 1.4: Calendar MCP server | Complete | mcp/google-calendar/index.ts - 7 tools, 2 resources |
| 2026-02-20 | Phase 1.5: Calendar skill | Complete | skills/calendar/skill.md - /calendar command |
| 2026-02-20 | Phase 1.6: Build verification | Complete | npm install + tsc compile successful |
