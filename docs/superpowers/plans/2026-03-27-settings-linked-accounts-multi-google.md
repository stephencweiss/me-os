# Settings: Linked Google accounts (cards) + multi-account sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an account-centric Settings → Linked Accounts experience: reachable **Connect / Add Google account** CTAs, card UI per linked Google identity (email always visible; optional label), correct **`account_label`** persistence (label or email), stable list ordering, **sync per account** and **sync all** with best-effort aggregation, and **1-minute backoff** with clear skip messaging.

**Architecture:** Extend the existing `/api/google/link/*` OAuth pipeline with an optional **`accountLabel`** in the signed cookie payload; callback resolves final label as **trimmed user label** or **Google profile email**. Rebuild **`/settings/accounts`** around cards calling existing **`GET/DELETE /api/calendar/linked`** and **`POST /api/calendar/sync`**, extending sync with **`all: true`** and **`last_sync_completed_at`** (or equivalent) on **`linked_google_accounts`** for backoff. Keep **one in-process sync lock per user** (`sync-lock.ts`); run **sequential** per-linked-account work inside **`all: true`** so partial failures still return aggregated errors (true parallel sync is out of scope unless we add per-account locks later).

**Tech Stack:** Next.js App Router (`web/`), Clerk, Supabase + RLS, Vitest (`pnpm --filter web test:run`), existing Google OAuth helpers.

**Design spec:** `docs/superpowers/specs/2026-03-27-settings-calendar-sync-multi-account-design.md`

---

## File map (create / modify)

| File | Responsibility |
|------|------------------|
| `web/lib/google-link-state-cookie.ts` | Extend `GoogleLinkStatePayload` with optional `accountLabel`; validate in `parseGoogleLinkStateCookieValue`. |
| `web/app/api/google/link/start/route.ts` | Read optional `label` query; validate; embed in cookie payload. |
| `web/app/api/google/link/callback/route.ts` | Pass resolved label + profile into upsert. |
| `web/lib/linked-google-accounts.ts` | `upsertLinkedGoogleFromWebOAuth` accepts optional label; default **`account_label`** to **`googleEmail`** when no label; fix current hardcoded `"calendar"`. `getLinkedAccountsForUser`: **stable order** (e.g. `google_email` asc). Optionally `PATCH` or separate route for label edit (Phase 4). |
| `supabase/migrations/00007_...sql` | Add **`last_sync_completed_at TIMESTAMPTZ NULL`** to `linked_google_accounts` (next free number after `00006_mobile_oauth_handoff.sql`). |
| `web/lib/database.types.ts` | Regenerate via `pnpm db:types` after migration, or patch types if CI allows. |
| `web/lib/calendar-sync-supabase.ts` | On successful sync for a linked account, set **`last_sync_completed_at = now()`** for that row. |
| `web/app/api/calendar/sync/route.ts` | Parse `{ all?: boolean }`; implement **all** path; **skip** if `last_sync_completed_at` within 1 minute (per linked id for single sync; for `all`, apply per account); return **`409` or structured `{ skipped: true, reason }`** per spec preference (use JSON body consistent with existing API). |
| `web/lib/sync-lock.ts` | No change unless we later split locks by `linkedAccountId` (not in this plan). |
| `web/app/settings/accounts/page.tsx` | Card layout; Clerk email-only copy; Connect / Add buttons → `withBasePath("/api/google/link/start")` (+ optional `?label=` from modal); per-card Sync; global Sync all; Disconnect; soft cap **5** + escape hatch; show query-param toasts for `google_linked`, `google_link` errors. |
| `web/__tests__/lib/google-link-state-cookie.test.ts` | **Create** — round-trip optional label. |
| `web/__tests__/lib/linked-google-accounts-label.test.ts` | **Create** — pure functions for label resolution if extracted; else test via integration-style imports. |
| `web/__tests__/api/calendar-sync.test.ts` | **Create or extend** — sync body `all`, skip window (mock DB or supabase mock). |

---

## Testing strategy

- **Unit / lib:** Cookie parse + label validation; label resolution helper (`trim`, max 64, reject control chars).
- **API route tests:** `POST /api/calendar/sync` with `all: true`, empty linked list, invalid id; skip response when inside 1-minute window (mock `last_sync_completed_at` or inject clock via test helper).
- **Manual:** Settings page — Connect, return from Google, cards show email; Add second account with label; Sync one vs Sync all; rapid double-click shows skip message; DELETE refreshes list.

**Commands:** `pnpm test` (repo root), `pnpm --filter web test:run`, `pnpm --filter web build`.

---

### Task 1: OAuth state + start route — optional label

**Files:**
- Modify: `web/lib/google-link-state-cookie.ts`
- Modify: `web/app/api/google/link/start/route.ts`
- Create: `web/__tests__/lib/google-link-state-cookie.test.ts`

- [ ] **Step 1:** Extend `GoogleLinkStatePayload` with optional `accountLabel?: string`. In `parseGoogleLinkStateCookieValue`, accept payload when `accountLabel` is absent, a non-empty string, or treat invalid types as null.

- [ ] **Step 2:** Add `validateAccountLabelForOAuth(input: string | undefined): string | undefined` in a small module (e.g. `web/lib/account-label.ts`) or inline in start route: trim; if empty return `undefined`; max length 64; reject `/[\x00-\x1f]/`.

- [ ] **Step 3:** In `GET /api/google/link/start`, read `request.nextUrl.searchParams.get("label")`, validate, set `payload.accountLabel` when defined.

- [ ] **Step 4:** Write tests: cookie round-trip with and without `accountLabel`; reject oversized label at start route (400 JSON or redirect — pick one and document).

- [ ] **Step 5:** Run `pnpm --filter web test:run -- google-link-state-cookie` (or full web tests). Commit: `feat(web): optional account label in Google link OAuth state`.

---

### Task 2: Callback + upsert — persist label or email

**Files:**
- Modify: `web/app/api/google/link/callback/route.ts`
- Modify: `web/lib/linked-google-accounts.ts`

- [ ] **Step 1:** Thread `payload.accountLabel` into `upsertLinkedGoogleFromWebOAuth` (extend params with `preferredLabel?: string`).

- [ ] **Step 2:** In `upsertEncryptedLinkedRow` / `upsertLinkedGoogleFromWebOAuth`, set `account_label` to **`trimmed preferredLabel`** if non-empty; else **`params.googleEmail`**; if email missing (should not happen), fallback to `"unlabeled"` or `sub` slice — document choice.

- [ ] **Step 3:** Remove hardcoded `accountLabel: "calendar"` in `upsertLinkedGoogleFromWebOAuth`.

- [ ] **Step 4:** Run `pnpm --filter web test:run` and `pnpm --filter web build`. Commit: `feat(web): persist Google link account_label from label or email`.

---

### Task 3: Stable ordering for linked accounts

**Files:**
- Modify: `web/lib/linked-google-accounts.ts` (`getLinkedAccountsForUser`)
- Modify: `web/app/api/calendar/linked/route.ts` (JSDoc only if response shape unchanged)

- [ ] **Step 1:** Change `.order("created_at", { ascending: true })` to **`.order("google_email", { ascending: true })`** (or `updated_at desc` if product prefers recency — **spec says document**; prefer **`google_email` asc** for stable UX).

- [ ] **Step 2:** Document sort order in route JSDoc. Commit: `fix(web): stable sort for GET /api/calendar/linked`.

---

### Task 4: DB — `last_sync_completed_at`

**Files:**
- Create: `supabase/migrations/00007_linked_google_accounts_last_sync.sql` (verify next free number under `supabase/migrations/`)
- Regenerate: `web/lib/database.types.ts` via `pnpm db:types` from repo root (requires env per project docs)

- [ ] **Step 1:** Add nullable `last_sync_completed_at TIMESTAMPTZ` to `public.linked_google_accounts`.

- [ ] **Step 2:** Apply migration in dev (`pnpm db:push`) and regenerate types.

- [ ] **Step 3:** Commit migration + types: `feat(db): last_sync_completed_at on linked_google_accounts`.

---

### Task 5: Calendar sync — write timestamp + skip window

**Files:**
- Modify: `web/lib/calendar-sync-supabase.ts`
- Modify: `web/app/api/calendar/sync/route.ts`

- [ ] **Step 1:** After a **successful** `runCalendarSync` for a linked account, update that row’s **`last_sync_completed_at`**.

- [ ] **Step 2:** At start of single-account sync path: if `last_sync_completed_at` is within **60 seconds** of `now()`, return **200** with JSON like `{ ok: true, skipped: true, reason: "recent", lastSyncAt: "..." }` (align with existing `{ ok, stats, errors }` shape — avoid breaking clients; see Step 3).

- [ ] **Step 3:** Define response contract in JSDoc: when `skipped: true`, `stats` may be zeroed; UI shows message from spec.

- [ ] **Step 4:** Implement `POST` body `{ "all": true, "start"?, "end"? }`: acquire **`withCalendarSyncLock`** once; for each linked account (same order as GET), call `runCalendarSync` **sequentially**; collect stats/errors; skip individual accounts inside 1-minute window without failing whole request.

- [ ] **Step 5:** When `linkedAccountId` omitted and `all` not set, default to **first row in same order as GET** (document).

- [ ] **Step 6:** Tests + commit: `feat(web): calendar sync skip window and sync all`.

---

### Task 6: Settings UI — cards, CTAs, sync, disconnect

**Files:**
- Modify: `web/app/settings/accounts/page.tsx`
- Optional: `web/app/components/` — extract `LinkedGoogleAccountCard.tsx` if file exceeds ~300 lines

- [ ] **Step 1:** Add intro line: MeOS sign-in is **email** (Clerk); Google Calendar is separate.

- [ ] **Step 2:** Primary **`href={withBasePath("/api/google/link/start")}`** (use `<a>` or `window.location` — must be full navigation for GET). Secondary **Add Google account** uses same URL; optional **modal** for label → append `?label=` (encoded).

- [ ] **Step 3:** Replace flat list with **cards**: always show **`google_email`**; show **`account_label`** only when different from email or always as subtitle — **spec: email always visible**; if label equals email, show email once.

- [ ] **Step 4:** Per card: **Sync** → `POST /api/calendar/sync` with `{ linkedAccountId }`; **Disconnect** → `DELETE` with `id`. Loading and error states.

- [ ] **Step 5:** Global **Sync all** when `linked.length > 1` → `POST` with `{ all: true }`; display aggregated message + per-account errors from response.

- [ ] **Step 6:** Handle **`skipped`** in sync response (toast or inline text).

- [ ] **Step 7:** Soft limit: if `linked.length >= 5`, disable Add with message + **escape hatch** (mailto or link to GitHub issue — placeholder URL in spec).

- [ ] **Step 8:** Read `useSearchParams()` for `google_linked`, `google_link` from callback redirect; show user-friendly messages.

- [ ] **Step 9:** Run `pnpm --filter web test:run`, `pnpm --filter web build`. Commit: `feat(web): linked accounts settings cards and sync`.

---

### Task 7: Product signal — “need more than 5 accounts”

**Files:**
- Modify: `web/app/settings/accounts/page.tsx` (or a tiny analytics helper)

- [ ] **Step 1:** When user clicks escape hatch, optionally `fetch` to a stub endpoint **`POST /api/meos/feedback`** (only if trivial) or use **`mailto:`** with subject line for ops — **YAGNI:** prefer **mailto** or static link in MVP.

- [ ] **Step 2:** Document in plan commit message that analytics can be added later.

---

## Verification checklist (before merge)

- [ ] `pnpm test` (root) passes
- [ ] `pnpm --filter web test:run` passes
- [ ] `pnpm --filter web build` passes
- [ ] Manual smoke: link two Google accounts, sync all, disconnect one, reconnect

---

## References

- Spec: `docs/superpowers/specs/2026-03-27-settings-calendar-sync-multi-account-design.md`
- `web/lib/with-tenant-supabase.ts`, `web/lib/auth-helpers.ts`
