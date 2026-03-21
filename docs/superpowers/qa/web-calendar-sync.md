# QA: Web calendar sync (Supabase)

Manual and spot-check guide for **Google Calendar → Supabase** sync in the Next.js webapp: linked OAuth tokens, `POST /api/calendar/sync`, Settings UI, and downstream dashboard reads.

**Related:** [Design spec](../specs/2026-03-19-web-calendar-sync-design.md) · [Implementation plan](../plans/2026-03-19-web-calendar-sync.md)

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Local webapp | From repo root: `pnpm install`, then `cd web && pnpm dev` (see `CLAUDE.md`). |
| Env | `web/.env.local` with Supabase, NextAuth, and **`TOKEN_ENCRYPTION_KEY`** (32-byte key, base64 or hex per app docs / `.env.example`). Missing key → encrypt/decrypt failures when persisting or using tokens. |
| DB | Migrations applied (`pnpm db:push` from repo root — see `scripts/migrations/README.md`); `user_id` FKs and `events.removed_at` present. |
| Google account | Sign in with **Google**; consent must include **Calendar** scope (re-consent after scope changes). |
| Optional | Supabase Table Editor (or SQL) to inspect `linked_google_accounts`, `events`, `daily_summaries`. |

---

## Automated checks (before / after manual QA)

```bash
# Repo root
pnpm test

# Webapp unit tests only
pnpm --filter web test:run
```

Relevant automated coverage today includes token crypto and calendar event id helpers; extend this list as route/sync-engine tests land.

---

## Entry points (UI)

1. **Settings → Linked Accounts → Sync calendar**  
   Path: `/settings/accounts` — section id **`calendar-sync`** (deep link: `/settings/accounts#calendar-sync`).

2. **Dashboard / Settings shortcuts**  
   Links that point at `#calendar-sync` should scroll the sync section into view after load.

---

## API reference (spot checks)

**`POST /api/calendar/sync`**

| Case | Expected |
|------|----------|
| No session | **401** from `requireAuth` (same as other protected routes). |
| Invalid JSON body | **400** `{ error: "Invalid JSON body" }`. |
| `start` / `end` not `YYYY-MM-DD` | **400** with validation message. |
| `start` after `end` | **400** `start must be on or before end`. |
| No linked Google row with tokens | **400** `ok: false` and message to re-sign-in with Calendar scope. |
| `linkedAccountId` not owned by user | **400** `linkedAccountId not found for user`. |
| Sync already running for this user | **409** `ok: false`, `error: "Calendar sync already running for this user"` (in-process lock, single server instance). |
| Success (any calendar / upsert work) | **200** with `ok: true` when `calendarsProcessed > 0` or `upserted > 0`, or when `errors` is empty. |
| All calendars fail | **200** with `ok: false` and populated `errors` (no HTTP error if the route itself ran). |

**Optional body:** `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "linkedAccountId": "<id>" }`  
**Default window:** UTC **today − 30** through **today + 30** (inclusive calendar days), same as Settings copy.

Example (authenticated cookie session; adjust for your tool):

```bash
curl -sS -X POST http://localhost:3000/api/calendar/sync \
  -H "Content-Type: application/json" \
  -H "Cookie: <next-auth session cookie>" \
  -d '{}'
```

---

## Manual test cases

### M1 — Happy path (first sync)

1. Sign in with Google (fresh session if you changed scopes).
2. Open `/settings/accounts#calendar-sync`.
3. Click **Sync calendar now**.
4. **Expect:** Success message with **fetched**, **upserted**, **removed** counts; no red per-calendar error block (or only expected warnings if a secondary calendar is restricted).
5. Open **Dashboard** (or views that read `/api/calendars` / events). **Expect:** Calendars and events reflect Google data in the default window.

### M2 — Linked account persistence

1. After Google sign-in, in Supabase open **`linked_google_accounts`** for your `user_id`.
2. **Expect:** Row with expected email/label; tokens stored encrypted (not plaintext in UI).

### M3 — Re-sync (idempotent)

1. Run sync twice without changing Google.
2. **Expect:** Second run completes; upsert counts may differ slightly but no duplicate primary keys; UI remains stable.

### M4 — Soft remove

1. Note an event in the sync window that appears in MeOS.
2. Delete or move that event **outside** the synced window in Google Calendar (or delete it).
3. Sync again.
4. **Expect:** `markedRemoved` &gt; 0 when appropriate; event no longer appears in app reads (queries exclude `removed_at`).

### M5 — Partial calendar failure

1. Use an account with multiple calendars where at least one is inaccessible or errors (e.g. revoked subscription, API error).
2. **Expect:** **200** response if any work succeeded; `errors[]` lists `calendarSummary` + `message`; other calendars still processed.

### M6 — Concurrent sync (lock)

1. Trigger a long sync (large window or slow network), then immediately trigger a second **POST** for the same user (second tab or `curl`).
2. **Expect:** One completes; the other returns **409** with the busy message. (Lock is **in-memory per server process** — not shared across multiple Node instances.)

### M7 — Unauthenticated / wrong account

1. While logged out, `POST /api/calendar/sync` → **401**.
2. Logged in as user A, pass `linkedAccountId` belonging only to user B (if you can construct it) → **400** not found.

### M8 — Custom date range

1. `POST` with body `{ "start": "2026-01-01", "end": "2026-01-07" }`.
2. **Expect:** **200** and `dateRange` echoed; events in DB align with that window behavior.

### M9 — Token refresh

1. Let access token expire (or simulate by waiting), then sync again.
2. **Expect:** Sync still succeeds; refreshed tokens persisted on linked row if Google returns new credentials.

---

## Data integrity checks (Supabase)

After a successful sync, spot-check:

- **`events`:** Rows for your `user_id` in range; `id` stable per engine rules; `removed_at` null for active rows.
- **`daily_summaries`:** Dates touched by the sync window updated consistently with events (reconciliation runs after sync).

---

## Regression cues

- **Colors / categories:** Timed vs all-day events; Google color mapping and title-based suggestions behave per `calendar-sync-supabase` + `calendar-suggest`.
- **Timezone / `date` key:** Events crossing UTC midnight still map to a deterministic `date` per implementation (note oddities in QA notes if seen).

---

## Sign-off checklist

- [ ] M1 happy path
- [ ] M2 linked row + encrypted tokens
- [ ] M3 re-sync
- [ ] M4 soft remove
- [ ] M5 partial errors surfaced in UI (`syncDetail`)
- [ ] M6 409 under concurrent sync (single instance)
- [ ] M7 auth / ownership
- [ ] M8 custom range (API)
- [ ] `pnpm test` and `pnpm --filter web test:run` green

Record **environment** (branch, commit, local vs deployed), **Google account type** (workspace vs consumer), and **screenshots** of Settings sync result + any `errors[]` payloads for defects.
