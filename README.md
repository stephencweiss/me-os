# MeOS - Personal Operating System

A personal productivity system built as Claude Code skills and MCP integrations. MeOS consolidates calendar management, time tracking, and schedule optimization into a conversational interface.

## Features

### Available Skills

| Skill | Description | Status |
|-------|-------------|--------|
| `/calendar` | Week-at-a-glance view, event colors, RSVP management | Available |
| `/time-report` | Time analysis, gap detection, category breakdowns | Available |
| `/calendar-optimizer` | Goal-based schedule optimization | Available |
| `/one-on-one` | 1:1 note processing (voice, image, text) and summaries | Available |
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
- **Testing**: Vitest (171 tests passing)

## Project Structure

```
me-os/
├── .claude/
│   └── skills/           # Claude Code skill definitions
│       ├── calendar/
│       ├── time-report/
│       ├── calendar-optimizer/
│       └── one-on-one/
├── mcp/
│   └── google-calendar/  # MCP server (11 tools, 2 resources)
├── lib/
│   ├── google-auth.ts    # OAuth2 multi-account support
│   ├── time-analysis.ts  # Gap detection, color grouping
│   ├── calendar-manager.ts # Overlap detection, flex slots
│   ├── calendar-optimizer.ts # Goal parsing, slot allocation
│   ├── calendar-filter.ts # Calendar type system
│   ├── schedule.ts       # Weekly schedule configuration
│   └── one-on-one.ts     # 1:1 note management
├── scripts/
│   └── weekly-report.ts  # Standalone time report CLI
├── config/               # Configuration files
│   ├── sensitive/        # Credentials & tokens (gitignored)
│   │   ├── credentials-*.json
│   │   └── tokens-*.json
│   ├── colors.json       # Semantic color definitions
│   ├── calendars.json    # Calendar type config (gitignored - personal)
│   ├── schedule.json     # Weekly schedule template
│   └── optimization-goals.json
├── config.example/       # Config templates
├── tests/                # Unit tests (Vitest)
└── plans/                # Implementation plans
```

## Color Schema

Events are color-coded with semantic meaning. **Source of truth:** `config/colors.json`.

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
4. Save credentials to `config/sensitive/credentials-{account}.json`
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

### Dependency Rules Configuration

Dependent coverage rules are configured in `config/dependencies.json`.

- `config.example/dependencies.json` is a template only.
- Calendar names like `Social`, `Family`, or `Travel` in the example may not exist in your account.
- You must replace them with your real calendar names in `config/dependencies.json`.

Rule fields:
- `trigger.sourceCalendars`: calendars scanned for source events that trigger a rule.
- `requirement.coverageSearchCalendars`: calendars searched for existing coverage.
- `requirement.createTarget.account` + `requirement.createTarget.calendar`: where missing coverage should be created.

Validate your config against live authenticated accounts/calendars:

```bash
npm run validate:dependencies
```

This validation fails fast with explicit errors if any source/search/target account/calendar references are invalid.

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

### One-on-One Notes

```
/one-on-one <name>              # Start or continue 1:1 with person
/one-on-one <name> add <file>   # Process voice/image/markdown file
/one-on-one <name> note         # Add text notes interactively
/one-on-one <name> summary      # Generate summary from today's notes
/one-on-one <name> history      # View past 1:1s
/one-on-one list                # List all direct reports
```

Supported file types:
- **Voice notes**: `.m4a`, `.mp3`, `.wav`, `.ogg` - transcribed using Claude's native audio
- **Handwritten notes**: `.jpg`, `.jpeg`, `.png`, `.heic` - interpreted using Claude's vision
- **Markdown files**: `.md`, `.txt` - loaded directly


## Development

### Running Tests

```bash
npm test
```

### Validate Dependency Config

```bash
npm run validate:dependencies
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
- **Phase 4**: One-on-One Management - Complete
- **Phase 5**: Project Dashboard - Planned

See `plans/me-os-implementation-plan.md` for detailed progress.

## License

Private - Personal use only
