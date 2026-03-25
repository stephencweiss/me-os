# MeOS - Personal Operating System

A personal productivity system built as Claude Code skills, MCP integrations, and a **Next.js web app** (`web/`). MeOS consolidates calendar management, time tracking, weekly goals, and schedule optimization into a conversational interface and a browser/mobile UI.

**Agent and contributor source of truth:** [`CLAUDE.md`](./CLAUDE.md) (skills registry, structure, commands). This README is the human-oriented overview.

## Features

### Claude Code skills

| Skill | Description | Status |
|-------|-------------|--------|
| `/calendar` | Week-at-a-glance view, event colors | Available |
| `/calendar-setup` | Calendar types for tracking and scheduling | Available |
| `/calendar-manager` | Conflicts, categorization, flex time | Available |
| `/calendar-optimizer` | Goal-based schedule optimization | Available |
| `/weekly-goals` | Weekly goals in MeOS (DB / web) | Available |
| `/time-report` | Time analysis, gaps, category breakdowns | Available |
| `/one-on-one` | 1:1 notes (voice, image, text) and summaries | Available |
| `/project-dash` | JIRA / project status dashboard | Planned |

### Web app (`web/`)

- **Routes:** `/today` (agenda), `/week?range=…` (roll-up analytics), `/goals`, `/settings` (and linked accounts). `/` redirects to `/today`; `/day` redirects to `/today`.
- **Mobile:** Capacitor iOS shell loads the hosted Next app; system-browser Google OAuth for native (see env notes below).

### Google Calendar MCP Server

Calendar tools (list calendars, events, week view, create/update/delete events, colors, RSVP, etc.) live under `mcp/google-calendar/`. Configure via `.mcp.json` as in [Configure Claude Code](#configure-claude-code) below.

### Multi-account support

Multiple Google accounts (e.g. personal + work) with merged, chronological views.

## Tech stack

- **Languages:** TypeScript, Node.js
- **CLI / skills:** Claude Code, MCP servers
- **Web:** Next.js (App Router) in `web/`, Auth.js, Supabase adapter, Vitest + Testing Library
- **Calendar:** Google Calendar API (OAuth2)
- **Tests:** Run `pnpm test` at the repo root for the current count (root + `web/` workspaces).

## Project structure

```
me-os/
├── CLAUDE.md              # Canonical agent instructions (skills, commands)
├── AGENTS.md              # Symlink → CLAUDE.md (Codex)
├── web/                   # Next.js app (dashboard, goals, settings, Capacitor)
├── .claude/skills/        # Skill definitions (SKILL.md per skill)
├── mcp/                   # MCP servers (e.g. google-calendar/)
├── lib/                   # Shared Node utilities (calendar, auth, reports, …)
├── scripts/               # CLIs (sync, reports, migrations helpers, …)
├── supabase/migrations/   # Postgres DDL for the web app (apply: pnpm db:push from root)
├── docs/                  # Specs, plans, testing notes
├── config/                # Local config (gitignored secrets under config/sensitive/)
├── config.example/        # Templates
├── tests/                 # Root Vitest tests
└── plans/                 # Legacy / ad-hoc plans
```

## Color schema

Events use semantic colors. **Source of truth:** `config/colors.json`.

## Schedule configuration

The schedule defines waking and work hours by weekday (gap analysis and optimization). **Default** lives in `config/schedule.json` (see previous README sections in git history for the full JSON example). **Overrides** and **holidays** are supported there.

## Getting started

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** via Corepack: `corepack enable pnpm`
- Google Cloud project with Calendar API enabled (for calendar features)
- **Web app:** Supabase project + Google OAuth client for web (see `web/.env.local` patterns in `CLAUDE.md` / deployment docs)

### Installation (monorepo)

Use **one** install at the **repository root**; `pnpm-workspace.yaml` includes `web`, so workspace dependencies resolve together.

```bash
git clone <repo-url>
cd me-os
pnpm install
```

You do **not** need a separate `pnpm install` inside `web/` for normal development. If a stray `web/pnpm-lock.yaml` exists alongside the root lockfile, it can confuse tooling—prefer a **single root** `pnpm-lock.yaml`.

```bash
# Copy config templates
cp -r config.example/* config/

# Root TypeScript build (CLI / lib)
pnpm run build

# Web production build (from repo root or from web/)
pnpm --filter web run build
```

### Web app dev server

```bash
pnpm --filter web run dev
# → http://localhost:3000 (default); `/` redirects to `/today`
```

Create `web/.env.local` with at least `AUTH_URL` / `NEXTAUTH_URL`, Google OAuth IDs, and Supabase variables as required by your setup. Apply DB migrations from the repo root: `pnpm db:push` (see `scripts/migrations/README.md`).

### Capacitor / iOS simulator (OAuth)

- **`AUTH_URL` / `NEXTAUTH_URL`** must be the exact origin registered as an authorized redirect URI for Google (**`{origin}/api/auth/mobile/google/callback`**). Use `http://localhost:3000` for local simulator when the app loads that origin.
- If the WebView origin is not your API host (e.g. packaged `capacitor://` assets), set **`NEXT_PUBLIC_APP_ORIGIN`** to the same base you use for `AUTH_URL` (e.g. `http://localhost:3000` or your LAN URL) so native sign-in can reach `/api/auth/mobile/*`. **When to set it** is explained in `web/.env.local.example` (most local simulator flows can omit it).
- **`MOBILE_OAUTH_REDIRECT_SCHEME`** (server) and **`NEXT_PUBLIC_MOBILE_OAUTH_REDIRECT_SCHEME`** (client) should be the bare scheme name (e.g. `meos`), not `meos://`.
- **Custom URL scheme on iOS:** After Google OAuth, the server redirects to **`meos://auth/complete?...`**. The native app must declare the **`meos`** scheme in **`ios/App/App/Info.plist`** (`CFBundleURLTypes`). Without it, Safari shows an invalid/malformed address. Rebuild the iOS app in Xcode after changing the plist.

### Google Calendar Setup (CLI / MCP)

MeOS uses OAuth2 for Google Calendar. Create credentials in Google Cloud Console and save them under `config/sensitive/credentials-{account}.json`. Use `config.example/sensitive/credentials.json` as a shape reference.

Authenticate:

```bash
GOOGLE_ACCOUNT=personal pnpm run auth
GOOGLE_ACCOUNT=work pnpm run auth    # optional second account
```

Tokens are written to `config/sensitive/tokens-{account}.json`.

### Configure Claude Code

Add to `.mcp.json`:

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

### Dependency rules configuration

Dependent coverage rules live in `config/dependencies.json` (template: `config.example/dependencies.json`). Validate against live calendars:

```bash
pnpm run validate:dependencies
```

## Usage (skills)

### Time report

```
/time-report              # This week's summary
/time-report yesterday    # Yesterday's breakdown
/time-report today        # Today's schedule
```

### Calendar optimizer

```
/calendar-optimizer       # Analyze week with recurring goals
/calendar-optimizer status
/calendar-optimizer goals
/calendar-optimizer add-goal
```

### One-on-one notes

```
/one-on-one <name>
/one-on-one <name> add <file>
/one-on-one <name> note
/one-on-one <name> summary
/one-on-one <name> history
/one-on-one list
```

Supported inputs include voice, images, and markdown/text files (see skill docs).

## Development

| Task | Command |
|------|---------|
| All workspace tests | `pnpm test` (repo root) |
| Web tests only | `pnpm --filter web run test:run` |
| Root TypeScript check | `pnpm exec tsc --noEmit` |
| Web lint | `pnpm --filter web run lint` |

### Adding a new skill

1. Add or extend a plan under `docs/plans/` or `docs/superpowers/plans/`.
2. Prefer TDD where code is involved.
3. Add `.claude/skills/<name>/SKILL.md`.
4. Register the skill in **`CLAUDE.md`** (required).

## Implementation status

- **Phases 1–4** (calendar, time reports, calendar manager/optimizer, schedule, one-on-ones): shipped in skills + scripts.
- **Web app:** Today / week / goals UI, settings, Supabase-backed sessions, Capacitor shell (ongoing).
- **Phase 5:** Project dashboard — planned.

See `plans/me-os-implementation-plan.md` for historical detail.

## License

Private - Personal use only
