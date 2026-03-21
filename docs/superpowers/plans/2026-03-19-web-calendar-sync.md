# Web calendar sync (Supabase) — implementation plan

> **For agentic workers:** Use **subagent-driven-development** or **executing-plans** to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in webapp users persist Google OAuth tokens, run an explicit **Sync calendar** action, upsert **`events`** + **`daily_summaries`** in Supabase (−30/+30 days default), soft-remove vanished events, and surface per-calendar errors—aligned with `docs/superpowers/specs/2026-03-19-web-calendar-sync-design.md`.

**Architecture:** SQL migrations fix **`user_id`** FKs to **`next_auth.users`** and add **`events.removed_at`**. Server-only **AES-GCM** encrypts tokens in **`linked_google_accounts`**. NextAuth **`signIn`** upserts linked rows when Google returns tokens. A **`runCalendarSync`** engine (Google Calendar API → normalized rows → upsert → summaries) is invoked from **`POST /api/calendar/sync`** behind an **in-process sync lock** per user. UI: Settings (and optional dashboard empty-state) triggers sync and shows result.

**Tech stack:** Next.js 16 (App Router), NextAuth v5, `@supabase/supabase-js`, `googleapis`, existing `web/lib/db-supabase.ts`, Vitest.

**Spec:** `docs/superpowers/specs/2026-03-19-web-calendar-sync-design.md`

---

## File map (planned)

| Area | Create / modify |
|------|------------------|
| Migrations | `scripts/migrations/003_next_auth_fk_and_events_removed_at.sql` (name may split into two files if cleaner) |
| Types | `web/lib/database.types.ts` (regen `pnpm run db:types`) |
| Crypto | `web/lib/token-crypto.ts` |
| Linked accounts | `web/lib/linked-google-accounts.ts` |
| Sync engine | `web/lib/calendar-sync-supabase.ts` (or `web/lib/sync/` split if large) |
| Auth | `web/lib/auth.ts` (scopes + `events.signIn`) |
| API | `web/app/api/calendar/sync/route.ts` |
| DB reads | `web/lib/db-supabase.ts` (`getEvents`, `getCalendars`, summaries paths — filter `removed_at IS NULL`) |
| UI | `web/app/settings/accounts/page.tsx`, optional `web/app/components/Dashboard.tsx` empty CTA |
| Docs | `.env.example` (scope / TOKEN note if needed) |
| Tests | `web/__tests__/` or `tests/` — `token-crypto`, sync engine (mocked Google), API route (mocked engine) |

---

### Task 1: Database — FK to `next_auth.users`

**Files:**
- Create: `scripts/migrations/003_user_fk_next_auth.sql`
- Modify: (none beyond new migration)
- Run: `pnpm run db:push` from repo root; `pnpm run db:types`

- [ ] **Step 1:** Add migration that, for each table with `user_id UUID NOT NULL REFERENCES auth.users(id)` (`events`, `daily_summaries`, `weekly_goals`, `non_goals`, `goal_progress`, `non_goal_alerts`, `user_preferences`, `linked_google_accounts`), **drops** the existing FK and **adds** `REFERENCES next_auth.users(id) ON DELETE CASCADE`. Use `\d table` in SQL or `information_schema` to confirm auto-generated constraint names if drop fails.
- [ ] **Step 2:** Apply via `pnpm run db:push`; verify no errors.
- [ ] **Step 3:** `pnpm run db:types`; fix any TS fallout in `db-supabase.ts` if types change.
- [ ] **Step 4:** Commit: `feat(db): point user_id FKs to next_auth.users`

---

### Task 2: Database — `events.removed_at` (soft delete)

**Files:**
- Create: `scripts/migrations/004_events_removed_at.sql` (or merge into 003 if you prefer one migration file)
- Run: `pnpm run db:push`; `pnpm run db:types`

- [ ] **Step 1:** `ALTER TABLE events ADD COLUMN removed_at TIMESTAMPTZ NULL;` + index `(user_id, date) WHERE removed_at IS NULL` optional for perf.
- [ ] **Step 2:** Apply + regenerate types.
- [ ] **Step 3:** Commit: `feat(db): add events.removed_at for sync soft-delete`

---

### Task 3: Read path — hide removed events

**Files:**
- Modify: `web/lib/db-supabase.ts` (`getEvents`, any raw `events` selects used by summaries/calendars)

- [ ] **Step 1:** Ensure all event reads default to **`removed_at IS NULL`** (unless a future debug flag exists).
- [ ] **Step 2:** `computeSummariesFromEvents` / `getDailySummaries` consumers remain consistent.
- [ ] **Step 3:** Add or extend Vitest for `getEvents` filtering if a test harness exists; else manual verify via API.
- [ ] **Step 4:** Commit: `fix(webapp): exclude soft-removed events from queries`

---

### Task 4: Token encryption helper

**Files:**
- Create: `web/lib/token-crypto.ts`
- Test: `web/__tests__/lib/token-crypto.test.ts` (or `tests/`)

- [ ] **Step 1:** Implement **encrypt** / **decrypt** using **`TOKEN_ENCRYPTION_KEY`** (AES-256-GCM), IV + auth tag prefix pattern documented in code.
- [ ] **Step 2:** Fail fast in dev if key missing when encrypt/decrypt called.
- [ ] **Step 3:** Unit tests: round-trip, wrong key throws.
- [ ] **Step 4:** Commit: `feat(webapp): token encryption for linked Google accounts`

---

### Task 5: `linked_google_accounts` CRUD

**Files:**
- Create: `web/lib/linked-google-accounts.ts`
- Uses: `web/lib/supabase-server.ts`, `token-crypto.ts`, `database.types.ts`

- [ ] **Step 1:** `upsertLinkedAccountFromOAuth({ userId, account, profile })` — map NextAuth Google `account` + profile email; encrypt `access_token` / `refresh_token`; set `scopes`, `token_expiry` from `expires_at`.
- [ ] **Step 2:** `getLinkedAccountsForUser(userId)`, `getLinkedAccountById(userId, id)`.
- [ ] **Step 3:** Document **`linked_google_accounts.id`** (e.g. stable string `userId:google_user_id` or UUID).
- [ ] **Step 4:** Commit: `feat(webapp): linked_google_accounts persistence helpers`

---

### Task 6: NextAuth — Calendar scopes + `signIn` upsert

**Files:**
- Modify: `web/lib/auth.ts`

- [ ] **Step 1:** Set `authorization.params.scope` to include **`openid email profile`** plus **`https://www.googleapis.com/auth/calendar.readonly`** **or** **`.../auth/calendar`** if existing color/write APIs require write scope (audit `webapp` Google usage and choose one; document in comment).
- [ ] **Step 2:** Add **`events.signIn`**: if provider is Google and `account` has tokens, call `upsertLinkedAccountFromOAuth` (catch/log errors; do not block sign-in on DB failure—optional: queue retry).
- [ ] **Step 3:** Manual: sign out/in, confirm row in `linked_google_accounts` (Supabase Table Editor).
- [ ] **Step 4:** Commit: `feat(auth): Google Calendar scope + persist tokens to Supabase`

---

### Task 7: Sync engine core (`runCalendarSync`)

**Files:**
- Create: `web/lib/calendar-sync-supabase.ts`
- Reference: `lib/time-analysis.ts`, `lib/calendar-sync.ts`, `lib/calendar-manager.ts` (port **suggestCategory** / color mapping; same recurring rules as documented in those modules)

- [ ] **Step 1:** Define **stable `events.id`** format in a single exported function + JSDoc (Supabase-first; document only, no Turso coupling).
- [ ] **Step 2:** Implement **OAuth2 client** from decrypted tokens; refresh when expired.
- [ ] **Step 3:** `calendarList.list` → for each calendar (v1: all entries; hook for future exclude list), `events.list` with `timeMin`/`timeMax` (RFC3339 UTC for window), paginate `pageToken`; optional time-chunking if needed.
- [ ] **Step 4:** Map Google payloads → DB row shape: **`date`** derived by documented UTC rule from `start`; **`start_time`/`end_time`** as timestamptz; colors via shared **`COLOR_DEFINITIONS`** + **`suggestCategory`** behavior.
- [ ] **Step 5:** Upsert events **`onConflict(id)`**; for stored IDs in window that no longer appear from Google for that calendar, set **`removed_at = now()`** (per-calendar diff).
- [ ] **Step 6:** Recompute **`daily_summaries`** for touched dates (reuse `computeSummariesFromEvents` + upsert into `daily_summaries` or extract shared helper from `db-supabase.ts`).
- [ ] **Step 7:** Return `{ stats, calendarErrors: [{ calendarId, message }] }` — **do not throw** on single-calendar failure; continue others.
- [ ] **Step 8:** Unit tests with **mocked** `googleapis` or injected client.
- [ ] **Step 9:** Commit: `feat(webapp): Supabase calendar sync engine`

---

### Task 8: API — `POST /api/calendar/sync`

**Files:**
- Create: `web/app/api/calendar/sync/route.ts`
- Optional: `web/lib/sync-lock.ts` (Map + TTL) or inline mutex

- [ ] **Step 1:** `requireAuth()`; parse optional body `{ start?, end?, linkedAccountId? }`; default **today−30 .. today+30** in UTC date math.
- [ ] **Step 2:** **Per-user lock** (e.g. `syncLocks.get(userId)` promise chain or `AsyncMutex`) — reject or **202** with message if sync already running.
- [ ] **Step 3:** Load linked account(s); v1: one primary row if `linkedAccountId` omitted.
- [ ] **Step 4:** Call `runCalendarSync`; return JSON `{ ok: true, stats, errors: calendarErrors }` with **200** if any calendar succeeded; use **207** or **200** with `ok: false` only when all fail—document choice in handler.
- [ ] **Step 5:** Vitest: mock `runCalendarSync`, test auth 401, test lock behavior.
- [ ] **Step 6:** Commit: `feat(api): POST /api/calendar/sync`

---

### Task 9: UI — Sync button + feedback

**Files:**
- Modify: `web/app/settings/accounts/page.tsx`
- Optional: `web/app/components/Dashboard.tsx` (empty state)

- [ ] **Step 1:** Replace disabled “Coming Soon” with **Sync calendar** button; `POST /api/calendar/sync`; loading state; show stats + per-calendar errors.
- [ ] **Step 2:** If no linked account, show copy: re-auth / check Google permissions.
- [ ] **Step 3:** Optional: `user_preferences` **`last_calendar_sync_at`** display.
- [ ] **Step 4:** Commit: `feat(webapp): calendar sync UI on settings`

---

### Task 10: Docs + cleanup

**Files:**
- Modify: `.env.example`, optionally `web/README.md`

- [ ] **Step 1:** Document **`TOKEN_ENCRYPTION_KEY`**, Calendar scope re-consent note, **`docs/superpowers/plans/`** pointer if helpful.
- [ ] **Step 2:** Run `pnpm run test:run` (root + webapp as applicable).
- [ ] **Step 3:** Commit: `docs: calendar sync env and README notes`

---

## Testing strategy (summary)

| Layer | How |
|-------|-----|
| Migrations | `db:push` on dev project; smoke insert `events` with NextAuth `user_id` |
| Crypto | Vitest round-trip |
| Sync engine | Mock Google client; assert upsert + `removed_at` + partial errors |
| API | Vitest route tests with mocked engine + session |
| Manual QA | **`docs/superpowers/qa/web-calendar-sync.md`** — checklist, API matrix, Supabase spot-checks |
| E2E | Manual: sign in → sync → dashboard shows data |

---

## Execution options (after plan approval)

1. **Subagent-driven** — one subagent per task, review between tasks.  
2. **Inline** — same session, checkpoints after Tasks 2, 6, 8.

---

## Plan complete

Saved as: **`docs/superpowers/plans/2026-03-19-web-calendar-sync.md`**

Canonical plans location for new work: **`docs/superpowers/plans/`** (see `CLAUDE.md` + `.claude/workflows/planning.md`). Legacy files may remain under `plans/` until migrated.
