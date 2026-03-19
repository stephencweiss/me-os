# Web calendar sync → Supabase — design spec

**Date:** 2026-03-19  
**Status:** Draft for review  
**Decision:** **Option C** — v1 is **explicit user-triggered sync** (“Sync now” / connect flow), with storage and APIs shaped so we can add **automatic sync on login** or **scheduled jobs** later without redesign.

---

## 1. Problem

- The dashboard reads **`events`** and **`daily_summaries`** via `/api/summaries`, `/api/events`, `/api/calendars` (`webapp/lib/db-supabase.ts`).
- **NextAuth + Google** only establishes identity in **`next_auth`**; it does **not** populate calendar rows.
- **`linked_google_accounts`** exists (encrypted tokens, per-user Google identities) but has **no working write path** from the web app; Settings still shows “Coming Soon”.
- **`lib/calendar-sync.ts`** + **`scripts/sync-calendar.ts`** target **SQLite** (`calendar-db`), not Supabase — not reusable as-is for the webapp.

---

## 2. Goals (v1)

1. After the user completes an explicit action, **fetch Google Calendar events** for a configurable window and **upsert** into **`public.events`** for that MeOS user.
2. **Recompute or upsert** **`daily_summaries`** for affected dates so the existing dashboard stays correct without ad-hoc client logic.
3. **Persist OAuth tokens** in **`linked_google_accounts`** (encrypted), scoped by **NextAuth `user.id`** (UUID from `next_auth.users`).
4. **Design for extension:** a single internal “run sync for `userId` + `linkedAccountId` + date range” function callable from **POST /api/...** today and from a **cron** or **signIn event** tomorrow.

Non-goals (v1): background queue service, multi-region, incremental Google push notifications (webhooks), full parity with every CLI flag.

---

## 3. Approaches considered

### A. Duplicate OAuth: separate “Connect Google” OAuth (disabled NextAuth token use)

- **Pros:** Clear separation; can request narrow scopes on connect.
- **Cons:** Two Google consents, confusing UX, more moving parts.

### B. Capture tokens from existing NextAuth Google sign-in

- **Pros:** One consent (already `access_type: offline` + `prompt: consent` in `webapp/lib/auth.ts`); refresh token available on **first** consent; minimal new OAuth surface.
- **Cons:** Must hook **`events` or `signIn` callback** (or a one-time migration path) to encrypt and upsert **`linked_google_accounts`**; token rotation must update DB.

### C. Hybrid (recommended for v1)

- **Primary:** **B** — persist Google **`Account`** tokens into **`linked_google_accounts`** when present (see §5).
- **Fallback / multi-account later:** **A**-style “Link another Google account” using the same **web** OAuth client and a dedicated callback route (already hinted in Settings UI).

**Recommendation:** **C** implemented incrementally: ship **B + manual sync** first; add second-account linking when needed.

---

## 4. Architecture (v1)

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Settings / Dashboard
  participant API as POST /api/calendar/sync
  participant Auth as NextAuth session
  participant DB as Supabase (service role)
  participant G as Google Calendar API

  U->>UI: Click Sync
  UI->>API: POST (date range or default)
  API->>Auth: requireAuth → userId
  API->>DB: Load linked_google_accounts for userId
  API->>DB: Decrypt refresh/access
  API->>G: List calendars + events (window)
  API->>DB: Upsert events (idempotent keys)
  API->>DB: Upsert daily_summaries for touched dates
  API-->>UI: JSON stats / errors
```

### 4.1 Modules (suggested boundaries)

| Unit | Responsibility |
|------|------------------|
| **`lib/token-crypto.ts`** (or extend existing) | AES-256-GCM encrypt/decrypt using **`TOKEN_ENCRYPTION_KEY`**; constant-time compare avoided not required here. |
| **`lib/linked-google.ts`** | CRUD for **`linked_google_accounts`** via existing Supabase server client; map NextAuth account → row shape. |
| **`lib/calendar-sync-supabase.ts`** | **Pure sync engine:** input `(userId, linkedRow, start, end)` → Google fetch → normalize to `events` rows → upsert → rebuild summaries. No HTTP. |
| **`app/api/calendar/sync/route.ts`** | Auth, validation, load links, call engine, return result. |
| **NextAuth `events.signIn` or `callbacks.jwt`** | When `account.refresh_token` (or access) exists, **upsert** primary linked row (v1: single Google account per user acceptable). |

### 4.2 Idempotency & keys

- **`events.id`:** stable string per user + Google event instance, e.g. `${userId}:${googleEventId}:${start_time}` or reuse CLI convention if documented in `calendar-db` / migrate script — **must match** any existing import tooling.
- **`google_event_id`:** store Google’s event `id`; handle recurring instances (instance id vs master) same as SQLite sync where possible.
- **Upsert strategy:** `onConflict` on primary key or delete+insert for window (prefer upsert to avoid flicker).

### 4.3 Summaries

- After event upsert for date range **`[start, end]`**, recompute **`daily_summaries`** for those dates (reuse logic from **`computeSummariesFromEvents`** / port from **`lib/calendar-sync.ts`** + `generateDailySummary` behavior).
- Keep **analysis hour defaults** consistent with `/api/summaries` (9–17 unless user prefs later).

### 4.4 API contract (v1)

- **`POST /api/calendar/sync`**
  - Body (optional): `{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "linkedAccountId": "..." }`
  - Default window: last **30** days (align with CLI default) or **7** for faster first sync — **product choice** in implementation plan.
  - Response: `{ ok, stats: { fetched, upserted, deleted?, summariesUpdated }, errors?: [...] }`
- **Auth:** `requireAuth()`; **never** accept `userId` from client.

### 4.5 UI (minimal v1)

- Enable **“Sync calendar”** on Settings → Linked Accounts (or dashboard empty-state) calling the POST route; show progress + last sync time (optional: new `user_preferences` key `last_calendar_sync_at`).

---

## 5. Token persistence (NextAuth → Supabase)

- On **`signIn`** with Google, when `account.refresh_token` is present, encrypt **access_token**, **refresh_token**, set **scopes**, **token_expiry**, resolve **google_email** (Calendar **`calendarList.get("primary")`** or `profile.email` if trusted).
- **`account_label`:** v1 default **`"primary"`** or derived from email domain; user-renamable later.
- If **`refresh_token` missing** (Google only sends on first consent), UI copy: “Remove app access in Google Account settings and sign in again” or dedicated **re-auth** link — already common pattern.

---

## 6. Security

- **Server-only:** sync route and crypto; no tokens in browser beyond session cookie.
- **`TOKEN_ENCRYPTION_KEY`** required in production for token columns (already in `.env.example`).
- **Scopes:** reuse webapp Google OAuth client; ensure Calendar **read** scope is included for sync (extend provider `authorization.params.scope` if needed).
- **Service role:** existing pattern — server enforces `userId` from session on every query.

---

## 7. Prerequisite: `user_id` foreign keys vs NextAuth

`001_initial_schema.sql` defines **`user_id … REFERENCES auth.users(id)`** for **`events`**, **`linked_google_accounts`**, etc. The running app uses **NextAuth** users in **`next_auth.users`**, not Supabase Auth.

- **Symptom:** Inserts may **fail FK checks** if the NextAuth UUID is not present in **`auth.users`**.
- **Recommended fix (before or with sync PR):** migration to **`ALTER` foreign keys** on tenant tables to reference **`next_auth.users(id)`** (or drop FK and enforce in app — weaker). Align **`auth.uid()` RLS** story separately if you ever move off service role for user-scoped REST.

This item is **blocking** for reliable sync writes; confirm on a dev branch with a test insert.

---

## 8. Future hooks (post-v1)

- **Auto-sync on signIn:** call same engine with short cooldown (store `last_calendar_sync_at`).
- **Cron:** Vercel cron / external worker with **service role + explicit user list** or per-user scheduled jobs.
- **Multi-account:** second OAuth flow writing additional **`linked_google_accounts`** rows; sync iterates all links.

---

## 9. Testing

- **Unit:** token crypto round-trip; event id stability; summary math for fixture events.
- **Integration:** mock Google API or recorded fixtures; assert Supabase upserts with test `userId`.
- **Manual:** Settings → Sync → dashboard populated; re-run idempotent.

---

## 10. Open questions (for implementation plan)

1. Default sync window: **7** vs **30** days for first run?
2. **Deletes:** when an event disappears from Google, mark removed vs hard delete from `events`? (CLI may already define behavior — align.)
3. **Color / category mapping:** reuse **`COLOR_DEFINITIONS`** + `suggestCategory` from `calendar-manager` as in SQLite sync?

---

## Approval

- [ ] User reviewed and approved this spec (or noted edits).
- [ ] Then: create implementation plan (`plans/` or writing-plans workflow) and execute in small PRs: **FK migration → token capture → sync engine → API → UI**.
