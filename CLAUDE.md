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
│   ├── calendar/           # Week-at-a-glance and event color management
│   ├── calendar-manager/   # Conflict detection, categorization, and flex time
│   ├── calendar-optimizer/ # Goal-based weekly schedule optimization
│   ├── calendar-setup/     # Interactive calendar type configuration
│   ├── one-on-one/         # 1:1 note processing and reporting
│   └── time-report/        # Weekly time analysis and gap detection
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

### 2. Time Reports (`/time-report`)
- End-of-week retrospective: what did I do, how did I spend time?
- Gap analysis: unstructured/uncalendared time by day
- Interactive color assignment for unlabeled events
- Exportable/scriptable for automation

### 3. One-on-One Management (`/one-on-one`)
- Input: handwritten notes (image) or voice transcription
- Output: raw transcript + structured summary
- Integration: push to Lattice or Google Docs
- Maintain history per direct report

### 4. Calendar Setup (`/calendar-setup`)
- Configure calendar types (active, availability, reference, blocking)
- Control which calendars affect tracking, gap analysis, and scheduling
- Support multi-account calendar environments

### 5. Calendar Management (`/calendar-manager`)
- Detect and resolve scheduling conflicts
- Categorize unlabeled events with suggested color semantics
- Fill schedule gaps with optional flex blocks

### 6. Calendar Optimization (`/calendar-optimizer`)
- Define recurring weekly goals
- Analyze availability and propose time allocation
- Apply approved optimization events to calendar

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
- `/calendar-setup` - Configure calendar behavior across accounts
- `/calendar-manager` - Resolve conflicts, label events, and add flex blocks
- `/calendar-optimizer` - Plan schedule against weekly goals
- `/time-report` - Generate time analysis
- `/one-on-one [name]` - Process 1:1 notes
