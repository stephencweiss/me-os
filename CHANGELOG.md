# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
where versioning applies.

## [Unreleased]

### Changed

- **Workspace layout:** Next.js app directory and pnpm package renamed from **`webapp`** to **`web`** (`pnpm-workspace.yaml`, lockfile importers, docs, and scripts).
- **Package manager:** repo standardizes on **pnpm** only; removed `package-lock.json` files, ignore future lockfile churn, added `packageManager` to root and `web/package.json`, refreshed docs and scripts to use `pnpm` / `pnpm exec` / `pnpm dlx` instead of npm/npx.

### Added

- **`supabase/migrations/00000_next_auth_schema.sql`** — Official Auth.js / NextAuth `next_auth` schema (replaces manual adapter SQL before `db:push`).
- **`pnpm db:push` / `db:status` / `db:push:prod`** — Supabase migrations via Management API (`scripts/db-push.mjs`, adapted from animus-training training-app).
- **`pnpm db:types` / `db:types:check`** — Regenerate `web/lib/database.types.ts` (`scripts/db-gen-types.mjs`).
- **`supabase/migrations/`** — Canonical ordered DDL (`00000` Auth.js `next_auth`, then `00001`–`00005`); see `scripts/migrations/README.md`.

### Changed

- Postgres migration **`.sql` files** moved from `scripts/migrations/` to **`supabase/migrations/`** (same content, versioned names for `db:push`).

### Added

- **`web/lib/base-path.ts`** — `getBasePath()` / `withBasePath()` so client `fetch` and URLs respect **`NEXT_PUBLIC_BASE_PATH`** when the Next app is mounted under a prefix (e.g. reverse proxy / Hugo).
- **`web/__tests__/lib/base-path.test.ts`** — Vitest coverage for base-path helpers.
- **Safe-area CSS utilities** in `web/app/globals.css` — `pt-safe`, **`pt-safe-header`** (tall floor for notched iPhones when `env(safe-area-inset-top)` is `0`), `pb-safe`, `px-safe`, with legacy **`constant(safe-area-inset-*)`** fallbacks for older WebKit.
- **Root `viewport` export** in `web/app/layout.tsx` — `viewportFit: "cover"` so `env(safe-area-inset-*)` can resolve in Safari / **WKWebView** (Capacitor).

### Changed

- **`web/next.config.ts`** — `basePath` driven by `NEXT_PUBLIC_BASE_PATH`; `turbopack.root` set to the monorepo parent for stable dev in the pnpm workspace.
- **Client API calls** — `fetch("/api/…")` wrapped with `withBasePath` in `DayView`, `WeekOverview`, `WeeklyGoals`, `BulkActionBar`, and **`settings/accounts`** so JSON and actions hit the prefixed app path when deployed under a subpath.
- **Auth / deployment URLs** — `web/lib/auth-deployment-url.ts`, `web/lib/app-origin-client.ts` (`clientAbsoluteAppUrl`), `capacitor-auth-bridge`, and `google-sign-in-shell` aligned so mobile OAuth and absolute API bases include the configured base path when needed.
- **`web/proxy.ts`** — Sign-in redirect uses `{basePath}/login` when `NEXT_PUBLIC_BASE_PATH` is set.
- **`UserMenu`** — Settings control uses Next **`Link`** so navigation respects `basePath`.
- **`MainAppShell`** — Mobile header uses **`pt-safe-header`**; horizontal **`px-safe`** on narrow viewports; main **`padding-bottom`** includes tab bar height plus **`env(safe-area-inset-bottom)`**; compact Sync/Settings sizing on small screens.
- **`BottomTabNav`** — Smaller **20×20** outline icons (calendar, bars, checklist + checks), thinner stroke, **`pb-safe`**, ~**44px** min touch height.
- **`README.md`** — Subpath deployment docs: canonical public prefix **`/app/me-os`**, distinction from bare **`/app`**, and rewrite **destination** must keep the same path prefix as the Next deployment.
- **`web/.env.local.example`** — `NEXT_PUBLIC_BASE_PATH` and example `AUTH_URL` including `/app/me-os`.
- **`web/__tests__/lib/auth-deployment-url.test.ts`** — Coverage updates for callback URL construction with base path.

### Fixed

- **Capacitor / iOS** — Top app chrome (Sync, Settings, page titles) no longer sits under the **status bar / Dynamic Island** when **`safe-area-inset-top`** is missing or zero in the WebView (header **`pt-safe-header`** floor).

## [0.2.0] - 2026-03-20

Mobile **goal alignment** Phase 1 (backend + docs): week snapshot API, weekly audit persistence, SQL migrations, and NextAuth/Supabase schema fixes.

### Added

- `GET /api/week-alignment?week=YYYY-Www` — returns `AlignmentMobileV1` JSON (`schemaVersion`, goals, `syncHint`, audit block).
- `POST /api/week-alignment/audit` — body `{ week, action: dismiss | snooze | seen, snoozedUntil? }` for weekly audit state (E3).
- `schemas/alignment-mobile-v1.json` — JSON Schema for the mobile alignment DTO.
- `web/lib/week-alignment-core.ts` and `web/lib/week-alignment.ts` — pure DTO builder + loader (batch goal progress, calendar freshness hint).
- `web/lib/goal-constraints.ts` — parse `constraints_json` for per-goal windows (E4, shared with future slot work).
- `scripts/migrations/003_alignment_mobile.sql` — `weekly_audit_state`, `weekly_goals.constraints_json`.
- `scripts/migrations/004_repoint_user_fk_to_next_auth.sql` — repoint `user_id` FKs from `auth.users` to **`next_auth.users`** (matches NextAuth + `@auth/supabase-adapter`).
- `scripts/migrations/README.md` — how to apply migrations without `db:push`.
- `docs/designs/mobile-goal-alignment.md` — locked client strategy (native SwiftUI iOS, Track C auth).
- `docs/testing/week-alignment-local.md` — local test playbook (env, Vitest, manual GET/POST).
- `plans/mobile-alignment-mvp-build.md` — implementation checklist (Phase 1 vs Phase 2 slot-finder).

### Changed

- `scripts/migrations/001_initial_schema.sql` — new installs: `user_id` references **`next_auth.users`** (not `auth.users`).
- `scripts/migrations/003_alignment_mobile.sql` — `weekly_audit_state.user_id` references **`next_auth.users`**.

### Fixed

- `getWeeklyAuditState` (Supabase): if `weekly_audit_state` is missing, return `null` so `GET /api/week-alignment` still returns 200 with goals + `syncHint` (migration can follow).

### Removed

- Goal create UI: “Also create in Things 3” checkbox; `POST /api/goals` no longer returns `things3Url` / accepts `syncToThings3`.
