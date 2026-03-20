# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
where versioning applies.

## [Unreleased]

Nothing yet.

## [0.2.0] - 2026-03-20

Mobile **goal alignment** Phase 1 (backend + docs): week snapshot API, weekly audit persistence, SQL migrations, and NextAuth/Supabase schema fixes.

### Added

- `GET /api/week-alignment?week=YYYY-Www` — returns `AlignmentMobileV1` JSON (`schemaVersion`, goals, `syncHint`, audit block).
- `POST /api/week-alignment/audit` — body `{ week, action: dismiss | snooze | seen, snoozedUntil? }` for weekly audit state (E3).
- `schemas/alignment-mobile-v1.json` — JSON Schema for the mobile alignment DTO.
- `webapp/lib/week-alignment-core.ts` and `webapp/lib/week-alignment.ts` — pure DTO builder + loader (batch goal progress, calendar freshness hint).
- `webapp/lib/goal-constraints.ts` — parse `constraints_json` for per-goal windows (E4, shared with future slot work).
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
