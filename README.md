# MeOS - Personal Operating System

A personal productivity system built as Claude Code skills and MCP integrations. MeOS consolidates calendar management, time tracking, and schedule optimization into a conversational interface.

## Features

### Available Skills

| Skill | Description | Status |
|-------|-------------|--------|
| `/calendar` | Week-at-a-glance view, event colors, RSVP management | Available |
| `/time-report` | Time analysis, gap detection, category breakdowns | Available |
| `/calendar-optimizer` | Goal-based schedule optimization | Available |
| `/one-on-one` | 1:1 note processing and reporting | Planned |
| `/project-dash` | JIRA/project status dashboard | Planned |

### Google Calendar MCP Server

11 tools for comprehensive calendar management:

- `list_calendars` - List all accessible calendars
- `get_events` - Get events for a date range
- `get_week_view` - Week-at-a-glance with colors
- `get_today` - Today's events
- `search_events` - Search by title
- `create_event` - Create new events
- `update_event_color` - Change event colors
- `update_event_status` - RSVP (accept/decline/tentative)
- `update_event_time` - Reschedule events
- `delete_event` - Remove events
- `decline_event` - Smart decline with cleanup
- `get_color_definitions` - Semantic color meanings

### Multi-Account Support

Supports multiple Google accounts (e.g., personal + work) with unified views. Events from all accounts are merged and sorted chronologically.

## Tech Stack

- **Language**: TypeScript/Node.js
- **Runtime**: Claude Code skills and MCP servers
- **Calendar**: Google Calendar API (OAuth2)
- **Testing**: Vitest (108 tests passing)

## Project Structure

```
me-os/
├── .claude/
│   └── skills/           # Claude Code skill definitions
│       ├── calendar/
│       ├── time-report/
│       └── calendar-optimizer/
├── mcp/
│   └── google-calendar/  # MCP server (11 tools, 2 resources)
├── lib/
│   ├── google-auth.ts    # OAuth2 multi-account support
│   ├── time-analysis.ts  # Gap detection, color grouping
│   ├── calendar-manager.ts # Overlap detection, flex slots
│   ├── calendar-optimizer.ts # Goal parsing, slot allocation
│   └── schedule.ts       # Weekly schedule configuration
├── scripts/
│   └── weekly-report.ts  # Standalone time report CLI
├── config/               # Personal config (gitignored)
│   ├── credentials-*.json
│   ├── tokens-*.json
│   ├── colors.json
│   ├── schedule.json
│   └── optimization-goals.json
├── config.example/       # Config templates (copy to config/)
├── tests/                # Unit tests (Vitest)
└── plans/                # Implementation plans
```

## Color Schema

Events are color-coded with semantic meaning:

| Color | Name | Meaning |
|-------|------|---------|
| 1 | Lavender | 1:1s / People |
| 2 | Sage | Deep Work / Focus |
| 3 | Grape | Meetings |
| 4 | Flamingo | Blocked / Waiting |
| 5 | Banana | Admin / Ops |
| 6 | Tangerine | External |
| 7 | Peacock | Learning |
| 8 | Graphite | Personal |
| 9 | Blueberry | Flex / Available |
| 10 | Basil | Unassigned |
| 11 | Tomato | Urgent / Deadlines |

## Schedule Configuration

The schedule defines your waking hours and work hours by day of week, used for gap analysis and calendar optimization.

**Default schedule** (`config/schedule.json`):
```json
{
  "defaultSchedule": {
    "weekday": {
      "awakePeriod": { "start": 6, "end": 22 },
      "workPeriod": { "start": 9, "end": 17 }
    },
    "weekend": {
      "awakePeriod": { "start": 6, "end": 22 },
      "workPeriod": null
    }
  },
  "overrides": {},
  "holidays": []
}
```

- **Work days**: Gap analysis uses work hours (9am-5pm by default)
- **Weekends/holidays**: Gap analysis uses waking hours (6am-10pm)
- **Overrides**: Customize specific days (e.g., shorter Fridays)
- **Holidays**: Treated as weekends (no work hours)

## Getting Started

### Prerequisites

- Node.js 18+
- Claude Code CLI
- Google Cloud project with Calendar API enabled

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd me-os

# Install dependencies
npm install

# Copy config templates
cp -r config.example/* config/

# Build TypeScript
npm run build
```

### Google Calendar Setup

1. Create a Google Cloud project
2. Enable the Google Calendar API
3. Create OAuth2 credentials (Desktop app)
4. Save credentials to `config/credentials-{account}.json`
5. Authenticate each account:

```bash
# Authenticate personal account
GOOGLE_ACCOUNT=personal npm run auth

# Authenticate work account
GOOGLE_ACCOUNT=work npm run auth
```

### Configure Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "google-calendar": {
      "command": "node",
      "args": ["--loader", "ts-node/esm", "mcp/google-calendar/index.ts"],
      "cwd": "/path/to/me-os"
    }
  }
}
```

## Usage

### Time Report

```
/time-report              # This week's summary
/time-report yesterday    # Yesterday's breakdown
/time-report today        # Today's schedule
```

### Calendar Optimizer

```
/calendar-optimizer       # Analyze week with recurring goals
/calendar-optimizer status # Show goal progress
/calendar-optimizer goals  # Manage recurring goals
/calendar-optimizer add-goal # Add a new recurring goal
```

Example goals:
- "4 hours of writing time (1-2 hour sessions)"
- "workout 3x this week, 45 min each"
- "2h focus time in the morning"

## Development

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npx tsc --noEmit
```

### Adding a New Skill

1. Create a plan in `plans/`
2. Write tests first (TDD)
3. Implement the feature
4. Create skill file in `.claude/skills/{name}/SKILL.md`
5. Update this README

## Implementation Status

- **Phase 1**: Foundation & Google Calendar - Complete
- **Phase 2**: Time Reports & Analytics - Complete
- **Phase 2.5**: Calendar Manager - Complete
- **Phase 3**: Calendar Optimizer - Complete
- **Phase 3.5**: Schedule Configuration - Complete
- **Phase 4**: One-on-One Management - Planned
- **Phase 5**: Project Dashboard - Planned

See `plans/me-os-implementation-plan.md` for detailed progress.

## License

Private - Personal use only
