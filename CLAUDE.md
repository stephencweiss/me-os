# MeOS - Personal Operating System

A personal productivity system built as Claude Code skills and MCP integrations. MeOS consolidates calendar, time tracking, one-on-ones, and project management into a conversational interface.

## Pre-read

Before getting started, load and internalize .claude/SYSTEM-PROMPT.md.

For new features, always write a plan first. Plans are saved into plans/

## Tech Stack

- **Language**: TypeScript/Node.js
- **Runtime**: Claude Code skills and MCP servers
- **Calendar**: Google Calendar API
- **Project Management**: JIRA (via existing MCP)
- **HR/Feedback**: Lattice API
- **Docs**: Google Docs API

## Project Structure

```
me-os/
├── CLAUDE.md           # This file - project guidelines
├── .claude/skills/     # Claude Code skills
│   ├── calendar/           # Calendar viewing and color management
│   ├── calendar-manager/   # Active management: conflicts, categorization, flex time
│   ├── calendar-optimizer/ # Goal-based schedule optimization
│   ├── calendar-setup/     # Calendar type configuration
│   ├── time-report/        # Weekly time analysis and gap detection
│   └── one-on-one/         # 1:1 note processing and reporting
│
│   # Planned skill (not yet present in .claude/skills)
│   └── project-dash/       # JIRA/project status dashboard
├── mcp/                # MCP server implementations
│   └── google-calendar/# Google Calendar MCP server
├── plans/              # Plans for new features. Creates a record of work. Used for development. 
├── scripts/            # Standalone scripts (callable by skills)
├── lib/                # Shared utilities
└── config/             # Configuration and credentials
```

## Core Features

### 1. Calendar Integration (`/calendar`)
- Week-at-a-glance view with color coding
- Change event colors programmatically
- Colors have semantic meaning (define your color schema)

### 2. Calendar Setup (`/calendar-setup`)
- Configure calendar types for scheduling and reporting behavior
- Supports active, availability, reference, and blocking calendars
- Use when adding new accounts or changing calendar intent

### 3. Calendar Management (`/calendar-manager`)
- Detect and resolve overlapping meetings
- Categorize unlabeled events with color suggestions
- Fill open slots with configurable flex blocks

### 4. Calendar Optimization (`/calendar-optimizer`)
- Convert weekly goals into scheduled calendar blocks
- Propose changes first, then apply with confirmation
- Track recurring and ad-hoc goals against available time

### 5. Time Reports (`/time-report`)
- End-of-week retrospective: what did I do, how did I spend time?
- Gap analysis: unstructured/uncalendared time by day
- Interactive color assignment for unlabeled events
- Exportable/scriptable for automation

### 6. One-on-One Management (`/one-on-one`)
- Input: handwritten notes (image) or voice transcription
- Output: raw transcript + structured summary
- Integration: push to Lattice or Google Docs
- Maintain history per direct report

### 7. Project Dashboard (`/project-dash`) [Planned]
- JIRA integration for project status
- Ticket status changes, blockers, timeline health
- Code activity (who pushed, what repos)
- On-demand queries or nightly sync summaries

## Color Schema

Define semantic colors for calendar events:

| Color | Meaning |
|-------|---------|
| TBD   | Define based on your categories |

## Development Guidelines

- Skills should be conversational and interactive
- Prefer composable, single-purpose skills over monolithic ones
- Scripts in `/scripts` should be runnable standalone (no LLM required)
- Skills can invoke scripts for repeatability
- Store credentials securely in `/config` (gitignored)
- All plans should be committed alongside code changes. 
- All plans should have a section focusing on how we will prove to ourselves that it works as expected, i.e., a testing plan. 
- Every pull request is accompanied by a the plan - i.e., a document explaining the purpose of the change set

## Getting Started

1. Set up Google Calendar API credentials
2. Configure JIRA MCP server connection
3. (Optional) Set up Lattice API access
4. Install dependencies: `npm install`

## Commands

Skills are invoked via Claude Code:
- `/calendar` - View and manage calendar
- `/calendar-setup` - Configure calendar types across accounts
- `/calendar-manager` - Resolve conflicts, categorize, and block flex time
- `/calendar-optimizer` - Turn goals into proposed schedule changes
- `/time-report` - Generate time analysis
- `/one-on-one [name]` - Process 1:1 notes
- `/project-dash` - Project status overview (planned)
