# MeOS - Personal Operating System

A personal productivity system built as Claude Code skills and MCP integrations. MeOS consolidates calendar, time tracking, one-on-ones, and project management into a conversational interface.

## Source of Truth

- `CLAUDE.md` is the canonical source of truth for project agent instructions.
- `AGENTS.md` must be a direct symlink to `CLAUDE.md` so Codex reads this exact file.
- On this filesystem, `CLAUDE.md` and `claude.md` resolve to the same path; do not try to maintain separate content.
- If a new skill is added under `.claude/skills/`, update the Skills registry below in the same change.

## Skills

A skill is a set of local instructions stored in a `SKILL.md` file. Use these entries as the authoritative skill registry for both Claude and Codex.

### Available skills

- `calendar`: View and manage Google Calendar week/day views and event colors. (file: `/Users/sweiss/code/me-os/.claude/skills/calendar/SKILL.md`)
- `calendar-setup`: Configure calendar-type behavior for tracking, gap analysis, and scheduling. (file: `/Users/sweiss/code/me-os/.claude/skills/calendar-setup/SKILL.md`)
- `calendar-manager`: Active calendar management for conflicts, categorization, and flex-time creation. (file: `/Users/sweiss/code/me-os/.claude/skills/calendar-manager/SKILL.md`)
- `calendar-optimizer`: Goal-based schedule optimization and proposal/apply flow. (file: `/Users/sweiss/code/me-os/.claude/skills/calendar-optimizer/SKILL.md`)
- `weekly-goals`: Set, track, and review weekly goals from Things 3 with progress tracking and non-goal alerts. (file: `/Users/sweiss/code/me-os/.claude/skills/weekly-goals/SKILL.md`)
- `time-report`: Weekly/daily time analysis with gap detection and interactive categorization. (file: `/Users/sweiss/code/me-os/.claude/skills/time-report/SKILL.md`)
- `one-on-one`: Process and summarize 1:1 notes from voice, images, files, or text. (file: `/Users/sweiss/code/me-os/.claude/skills/one-on-one/SKILL.md`)

### Skill trigger and usage rules

- Use a skill when the user names it (e.g., `$calendar` or plain `calendar`) or when the task clearly matches the skill description.
- If multiple skills match, use the minimal set that covers the request and state the order briefly.
- Open and follow each skill's `SKILL.md` instructions directly from the file path listed above.
- If a required skill file is missing or unreadable, note it briefly and continue with the best fallback.

## Pre-read

Before getting started, load and internalize .claude/SYSTEM-PROMPT.md.

## Planning Workflow

For new features and non-trivial changes, follow the planning workflow in `.claude/workflows/planning.md`.

## Tech Stack

- **Language**: TypeScript/Node.js
- **Runtime**: Claude Code skills and MCP servers (Codex-compatible via `AGENTS.md -> CLAUDE.md`)
- **Calendar**: Google Calendar API
- **Project Management**: JIRA (via existing MCP)
- **HR/Feedback**: Lattice API
- **Docs**: Google Docs API

## Project Structure

```
me-os/
├── CLAUDE.md           # This file - project guidelines
├── AGENTS.md           # Symlink to CLAUDE.md for Codex
├── .claude/skills/     # Claude skills
│   ├── calendar/       # Calendar viewing and color management
│   ├── calendar-setup/ # Calendar type configuration
│   ├── calendar-manager/# Active conflict/category/flex management
│   ├── calendar-optimizer/ # Goal-based optimization
│   ├── time-report/    # Weekly time analysis and gap detection
│   └── one-on-one/     # 1:1 note processing and reporting
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

## Color Schema

Load `config/colors.json` which is the source of truth.

## Development Guidelines

- Skills should be conversational and interactive
- Prefer composable, single-purpose skills over monolithic ones
- Scripts in `/scripts` should be runnable standalone (no LLM required)
- Skills can invoke scripts for repeatability
- Store credentials securely in `/config` (gitignored)
- Follow the Planning Workflow (above) for all non-trivial changes
- `.claude/settings.local.json` is Claude runtime configuration and permissions. It is not the Codex skill registration mechanism.

<<<<<<< goal-creation
### Testing Requirements

Tests are critical for maintaining code quality. When making changes:

1. **Write tests for new functionality** - All new features, API endpoints, and database functions should have corresponding tests
2. **Update tests when modifying existing code** - If you change behavior, update or add tests to cover the changes
3. **Run tests before committing** - Use `npm run test:run` (or `npx vitest run`) to verify all tests pass
4. **Test file locations**:
   - Unit/integration tests: `tests/` directory
   - Test naming: `<feature>.test.ts` (e.g., `goal-creation.test.ts`)

Example test coverage expectations:
- Database functions: Test CRUD operations, edge cases, validation
- API routes: Test all HTTP methods, error handling, validation responses
- UI components: Test user interactions and state changes when feasible

### UI Component Standards

Maintain a consistent user experience by reusing existing components:

1. **Check for existing components first** - Before creating new UI elements, check `webapp/app/components/` for existing solutions
2. **Use standard components** - Prefer shared components over inline styles:
   - `Button.tsx` - Standard button with variants (primary, secondary, ghost, danger) and sizes (sm, md, lg)
   - More components to be added as the design system grows
3. **Extend existing components** - If a component doesn't quite fit, extend it with new variants/props rather than creating a duplicate
4. **Consistent styling patterns**:
   - Use Tailwind CSS classes
   - Follow existing color conventions (e.g., blue for primary actions)
   - Support dark mode (`dark:` variants)

When creating a new UI element:
- First, search existing components to see if one already exists
- If similar functionality exists, consider refactoring to make it reusable
- If creating new, follow the patterns established in existing components

=======
>>>>>>> main
## Worktree Development

Use git worktrees for isolated feature development:

### Creating a Worktree
```bash
./scripts/worktree-start.sh <feature-name>
cd ../worktrees/me-os/<feature-name>
```

### Setting Up Local Testing

Worktrees share git history but **not** gitignored files. Before running the app locally, copy sensitive configs from the main repo:

```bash
# From the worktree directory
MAIN_REPO="/Users/sweiss/code/me-os"

# Copy database config
cp "$MAIN_REPO/config/turso.json" ./config/

# Copy calendar credentials
cp "$MAIN_REPO/config/calendars.json" ./config/

# Copy sensitive directory (Google OAuth tokens, etc.)
cp -r "$MAIN_REPO/config/sensitive" ./config/

# Copy webapp environment variables
cp "$MAIN_REPO/webapp/.env.local" ./webapp/
```

### Required Config Files

| File | Purpose |
|------|---------|
| `config/turso.json` | Turso database credentials |
| `config/calendars.json` | Google Calendar account configs |
| `config/sensitive/` | OAuth tokens and credentials |
| `webapp/.env.local` | Next.js environment variables |

### Running the Webapp
```bash
cd webapp
npm install
npm run dev
# Opens at http://localhost:3001
```

## Getting Started

1. Set up Google Calendar API credentials
2. Configure JIRA MCP server connection
3. (Optional) Set up Lattice API access
4. Install dependencies: `npm install`

## Commands

Skills are invoked via Claude Code:
- `/calendar` - View and manage calendar
- `/calendar-setup` - Configure calendar types
- `/calendar-manager` - Resolve conflicts, categorize events, fill flex time
- `/calendar-optimizer` - Optimize schedule against goals
- `/time-report` - Generate time analysis
- `/one-on-one [name]` - Process 1:1 notes
