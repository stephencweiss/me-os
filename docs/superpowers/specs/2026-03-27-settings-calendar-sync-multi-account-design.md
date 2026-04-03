# Design: Settings → Linked Accounts & calendar sync (post-Clerk, multi-Google)

**Status:** Brainstorm / design (not implemented)  
**Date:** 2026-03-27  
**Depends on:** Clerk as web IdP; Google Calendar via `linked_google_accounts` (OAuth `/api/google/link/*`), not Google as Clerk SSO.

---

## 1. Problem

After Clerk, **there is no implicit “first Google account” from login.** Calendar access is always **explicit**: the user must complete MeOS’s **Connect Google Calendar** OAuth so tokens land in `linked_google_accounts`. The Settings page must make that path obvious, support **more than one** Google identity over time, and make **sync** predictable when multiple links exist.

## 2. Current implementation (snapshot)

| Layer | Behavior |
|--------|----------|
| **Auth** | Clerk session; `requireAuth()` → `public.users.id` via `publicMetadata.app_user_id`. |
| **Linking (API)** | `GET /api/google/link/start` → Google → `GET /api/google/link/callback`; PKCE + cookie binds OAuth to Clerk user. **Implemented and callable** for anyone who hits that URL with a valid Clerk session. |
| **Linking (UI)** | **Not reachable from the app today.** No button, link, or route in `web/app` navigates to `/api/google/link/start` (only API routes and libs reference it). Copy on Settings → Linked Accounts *talks* about “Connect Google Calendar” but does not provide a working CTA — users cannot complete linking through the UI without manually opening the API URL. |
| **Storage** | `linked_google_accounts`: one row per MeOS user × Google `sub`; `account_label` defaults to `"primary"` in code when not supplied (should become **email-backed default** per §5.2). |
| **List / remove** | `GET /api/calendar/linked` returns metadata; `DELETE /api/calendar/linked?id=` removes one link. |
| **Sync** | `POST /api/calendar/sync` accepts optional `{ linkedAccountId?, start?, end? }`. If omitted, **`linkedAccountId` defaults to the first linked row** (order-dependent). |
| **UI** | `web/app/settings/accounts/page.tsx`: sync button calls sync with **no body** (always default account). “Link another Google account” is **disabled** (“coming soon”). |

**Implication:** Backend is close to multi-account; the critical gap is **a real Settings UI** (connect CTA + card layout) plus **label/email rules**, **deterministic ordering**, and **sync** behavior for multiple links.

## 3. Goals

1. **Clarity:** User understands: MeOS sign-in (Clerk) ≠ Google Calendar (linked OAuth).
2. **Connect path:** Obvious, in-app entry to `/api/google/link/start` after sign-in; short explanation of scopes/consent.
3. **Multiple links:** User can add another Google account without breaking the first; optional **friendly label**; **Google email always visible** on every account row (whether or not a label is set).
4. **Sync:** Per-account and global “sync all” with clear progress; resilience and rate limits per §7.
5. **Safety:** Revoking a link (`DELETE`) leaves UI and sync list consistent.

**Non-goals (for this design):** Changing Clerk strategies; replacing PKCE/cookie flow; full Capacitor parity (tracked separately).

## 4. Approach

**Chosen: B — Account-centric page (cards).** Implement directly in this shape; do not stage a separate “minimal list” milestone first.

**Alternatives considered (not selected):**

- **A — Minimal list + second link:** Faster to ship but would be thrown away when moving to cards.
- **C — Add-account wizard:** Extra friction; card layout + inline label field before OAuth is enough.

**B — Account-centric page:** One **card** per linked Google account. Each card shows:

- **Google email** (always visible, primary identifier in the UI).
- **Optional label** (e.g. “Work”) when the user provided one; editing inline or via modal is fine.
- Actions: **Sync this account**, **Disconnect** (calls `DELETE`).
- Global header area: **Add Google account** (same OAuth entry as first link), **Sync all** when multiple links exist.
- Optional **last sync** time when we have data (event stats or a future `last_sync_at`).

---

## 5. Design

### 5.1 Information architecture

1. **Section: MeOS sign-in (short)** — Clerk sign-in is **email (and password) for now** — we do **not** offer social login yet. One line clarifying that MeOS account ≠ Google Calendar.
2. **Section: Linked Google accounts (cards)** — Primary surface: one card per link (see §4). **Connect / Add Google account** must be a real control that navigates to `/api/google/link/start` (with base path).
3. **Section: Calendar sync (global + per card)** — Date range (future): optional; MVP can keep one range for sync requests. **Sync all** at section or page level when `linked.length > 1`; each card has **Sync**.
4. **Section: Synced calendar data** — Existing aggregate from `/api/calendars` (e.g. “Synced Accounts” list); clarify it reflects **imported** data and may combine multiple Google links.

### 5.2 OAuth, labels, and email

- **Display rule:** **Google account email** (e.g. `scweiss1@gmail.com`) is **always shown** on the card. If the user sets a **label**, show both (e.g. label as title or subtitle, email always visible — never hide email behind label alone).
- **Stored `account_label`:**
  - If the user provides a **non-empty label** after trim → save that string.
  - If they **omit** a label → persist **`account_label` = Google account email** from the OAuth profile (same as we display). Avoid a generic `"primary"` default in UX unless we have no profile email (should not happen for a successful Google link).
- **`GET /api/google/link/start`** — May accept optional `label=` for the cookie payload; **final email** is always known **after** callback from Google profile. Callback should set `account_label` to **user label if provided in state**, else **profile email**.
- **Cookie payload** (`google-link-state-cookie`): include optional `accountLabel`; callback merges with profile email per rules above.

**Validation (when user types a label):** Trim, length 1–64, no control characters. Uniqueness remains `id` = `userId:googleSub`.

### 5.3 Sync behavior

| User action | Behavior |
|-------------|----------|
| **Sync** on a card | `POST /api/calendar/sync` with `{ "linkedAccountId": "<id>" }`. |
| **Sync all** | Prefer **`POST /api/calendar/sync` with `{ "all": true }`** (or equivalent) for one round-trip, **best-effort parallel** where safe: kick off work for each link; **if one fails, others may still succeed**; surface per-account errors. User can retry failed accounts. |
| **Global “Sync now”** (single prominent control) | If one link: sync that. If multiple: **Sync all** semantics. |

**Ordering:** `GET /api/calendar/linked` returns rows in a **stable, documented order** (e.g. `updated_at DESC` or `google_email ASC`) so defaults and tests are predictable.

### 5.4 Rate limiting & “skip” feedback (sync)

- **Sync all** is **best effort**; partial failure is acceptable; user retries as needed.
- **Backoff:** If the user triggers sync **too often**, skip redundant work and **tell them**. Simple rule: if this linked account (or whole-user sync) **already completed successfully within the last minute**, **skip** and show feedback (“Skipped — last sync less than a minute ago”). Tune later (e.g. max **5 syncs per hour** per user) if abuse appears; start with **1 / minute** gate for simplicity.
- **Future:** Parallel per-`linkedAccountId` sync may warrant **per-account locks** instead of only per-user — revisit if we parallelize heavily.

### 5.5 Edge cases

- **Same Google user re-links:** Upsert by `userId` + `sub` replaces tokens; label can be updated from a new flow.
- **Revoke in Google:** Sync errors surface per card; show re-connect for that row.
- **Clerk user, zero Google links:** Disable or explain sync; show **Add Google account** prominently.

### 5.6 Testing

- Unit: link state cookie round-trip includes optional `accountLabel`; default to profile email when absent.
- API: `POST /api/calendar/sync` invalid `linkedAccountId`; `all: true` with 0 or 2+ links; skip path when inside backoff window.
- UI: cards, email always visible, label optional, delete refresh, connect CTA reaches `/api/google/link/start`.

---

## 6. Phased delivery (suggested PRs)

1. **Reachable linking + cards v1:** Add **Connect / Add Google account** CTA (`withBasePath("/api/google/link/start")`); implement **card layout** (approach B) for 0…N links; fix contradictory copy; wire **Disconnect** and **per-card Sync**.
2. **Labels + cookie:** Optional label before OAuth; callback persists label or email; list API order documented.
3. **Sync all + backoff:** Server-side `all: true` (or client loop if blocked), parallel best-effort, **1/minute** skip with user-visible message; optional stricter cap later.
4. **Polish:** Inline label edit, last sync time, `user_preferences` default account if needed.

---

## 7. Decisions (resolved)

1. **OAuth client:** Use **one** Google Cloud OAuth client for all links; same redirect URI; `account_label` / intent lives only in MeOS state — **yes.**

2. **Max linked accounts:** Soft limit **5** in UI, with an **escape hatch** (e.g. “Need more?” contact or advanced path). **Product interest:** we want to **learn when and why** users ask for more than five (instrument or feedback hook).

3. **Sync all failure model:** **Best-effort / parallel attempt** — start work for each link; **one failure does not cancel the others**; user can retry. **Backoff:** if last successful sync for that scope was **within the last minute**, **skip** and show clear feedback (“Skipped — synced less than a minute ago”). Optionally tighten later (e.g. **5/hour**); MVP prefers **1/minute** simplicity.

4. **API vs UI for linking:** Linking is **fully implemented in the API** but **not exposed in the UI** until we ship the CTAs in §6 — confirmed.

---

## 8. References

- `web/app/settings/accounts/page.tsx`
- `web/app/api/google/link/start/route.ts`, `callback/route.ts`
- `web/lib/google-link-state-cookie.ts`, `web/lib/linked-google-accounts.ts`
- `web/app/api/calendar/sync/route.ts`, `web/app/api/calendar/linked/route.ts`
- Plan: `docs/superpowers/plans/clerk-replace-nextauth-web-login.md`
