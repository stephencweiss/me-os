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
| **Linking** | `GET /api/google/link/start` → Google → `GET /api/google/link/callback`; PKCE + cookie binds OAuth to Clerk user. |
| **Storage** | `linked_google_accounts`: one row per MeOS user × Google `sub`; `account_label` defaults to `"primary"` on first web upsert. |
| **List / remove** | `GET /api/calendar/linked` returns metadata; `DELETE /api/calendar/linked?id=` removes one link. |
| **Sync** | `POST /api/calendar/sync` accepts optional `{ linkedAccountId?, start?, end? }`. If omitted, **`linkedAccountId` defaults to the first linked row** (order-dependent). |
| **UI** | `web/app/settings/accounts/page.tsx`: sync button calls sync with **no body** (always default account). “Link another Google account” is **disabled** (“coming soon”). Copy references “Connect Google Calendar” but **a first-class connect CTA may be missing or easy to miss** — verify when implementing. |

**Implication:** Backend is already close to multi-account; the gap is mostly **product UX**, **deterministic ordering**, and **passing `account_label`** (or equivalent) into the link flow for second and later accounts.

## 3. Goals

1. **Clarity:** User understands: MeOS sign-in (Clerk) ≠ Google Calendar (linked OAuth).
2. **Connect path:** Obvious entry to `/api/google/link/start` after sign-in; optional short explanation of scopes/consent.
3. **Multiple links:** User can add another Google account without breaking the first; labels are human-meaningful (e.g. work / personal).
4. **Sync:** User can **sync one** linked account, **sync all** (sequential or parallel with clear progress), or set a **default** for the big “Sync now” button.
5. **Safety:** Revoking a link (`DELETE`) leaves UI and sync list consistent; no orphaned expectations.

**Non-goals (for this design):** Changing Clerk strategies; replacing PKCE/cookie flow; full Capacitor parity (tracked separately).

## 4. Approaches

### A — Minimal: enable second link + pass label in OAuth state

- **UX:** Re-enable “Link another Google account” as a button that hits `/api/google/link/start?label=…` (or `intent=additional` + modal for label). Show each row with email + label; per-row “Sync this account”.
- **API:** Extend `link/start` and callback cookie payload to carry **`account_label`** (validated: non-empty, max length, allowed charset). Upsert already sets `account_label`.
- **Sync:** Settings calls `POST /api/calendar/sync` with `linkedAccountId` when user clicks per-account sync; optional “Sync all” loops client-side or new `syncAll` server endpoint.
- **Pros:** Smallest change; matches existing schema and sync API.  
- **Cons:** Default “first row” ordering can surprise users unless we add **explicit default** or **sort order** in API.

### B — Account-centric page: each link is a card

- **UX:** One card per linked account: email, label (editable inline or in modal), last sync time (if tracked), actions [Sync] [Disconnect]. Single primary “Add Google account” at top. Global “Sync all” at top.
- **Pros:** Scales to 3+ accounts; clear mental model.  
- **Cons:** More UI work; may need **last_sync_at** (or reuse event stats) for usefulness.

### C — Wizard for “add account” only

- **UX:** First connect stays one-click; “Add another” opens a 2-step wizard (choose label → OAuth).  
- **Pros:** Reduces mistakes when naming accounts.  
- **Cons:** Heavier for a rare action; still need A or B for ongoing management.

**Recommendation:** **A now, evolve toward B** as the page grows. Ship: label in link flow + disabled ordering fix + per-account sync + optional “sync all” + visible Connect CTA. Add card layout and last-sync later if needed.

## 5. Design (approved sections)

### 5.1 Information architecture

1. **Section: Sign-in context (short)** — One line: “You’re signed in to MeOS with email/password or your chosen Clerk method. Google Calendar is connected separately.”
2. **Section: Calendar sync** — Date range (future): optional; for MVP keep single range for all syncs. Buttons: **Sync all linked accounts** (if `linked.length > 1`) and/or per-account actions in list.
3. **Section: Linked Google accounts** — List of links with email + `account_label`; primary actions **Connect / Add another** (same OAuth entry point with different label), **Remove** (calls `DELETE`).
4. **Section: Synced calendar data** — Existing “Synced Accounts” aggregate from `/api/calendars` remains; clarify that it reflects **data already imported**, which may span multiple Google links.

### 5.2 OAuth and `account_label`

- **`GET /api/google/link/start?label=`** — Optional. If absent, behavior today: default `"primary"` for new `sub`, or upsert existing `sub`.
- **First link:** Allow omitting label → `"primary"`.
- **Additional link:** Require either a **user-supplied label** before redirect (modal or dedicated input) or a **default** like `"account-2"` with rename later (worse UX; prefer prompt).
- **Cookie payload** (`google-link-state-cookie`): include `accountLabel` so callback can call `upsertLinkedGoogleFromWebOAuth` with the same label (see `linked-google-accounts.ts`).

**Validation:** Trim, length 1–64, no control characters; collision on label alone is OK (uniqueness is `id` = `userId:googleSub`).

### 5.3 Sync behavior

| User action | Behavior |
|-------------|----------|
| **Sync now** (primary) | If one link: sync that. If multiple: either sync **all** in sequence (clear aggregate message) or **last synced** / **default linked id** stored in `user_preferences` (future). **MVP recommendation:** If `linked.length > 1`, show chooser or default to **sync all** with combined stats. |
| **Per-account sync** | `POST /api/calendar/sync` with `{ "linkedAccountId": "<id>" }`. |
| **Sync all** | Option 1: client loops with N requests (reuse lock behavior — verify `withCalendarSyncLock` allows sequential calls). Option 2: `POST /api/calendar/sync` with `{ "all": true }` server-side loop. Prefer **server `all: true`** for one round-trip and consistent error aggregation. |

**Ordering:** `GET /api/calendar/linked` should return rows in a **stable order** (e.g. `updated_at DESC` or `account_label ASC`) and document it so “first” is predictable or UI never relies on implicit first.

### 5.4 Edge cases

- **Same Google user re-links:** Upsert by `userId` + `sub` replaces tokens; label can be updated from new flow if we allow.
- **Revoke in Google:** Sync errors surface per account; UI shows re-connect CTA for that row.
- **Clerk user, zero Google links:** Block sync with existing copy; show **Connect** prominently.

### 5.5 Testing

- Unit: link state cookie round-trip includes `accountLabel`.
- API: `POST /api/calendar/sync` with invalid `linkedAccountId`; `all: true` with 0 or 2+ links.
- UI: multi-link list, disabled states, delete refresh.

---

## 6. Phased delivery (suggested PRs)

1. **UX honesty:** Add visible **Connect Google Calendar** (`<a href={withBasePath("/api/google/link/start")}>` or `router.push` via location) and fix contradictory “above/below” copy.
2. **Labels in OAuth:** `label` query + cookie + callback; enable **Link another** with small modal for label.
3. **Sync:** Per-account buttons; optional **`syncAll`** API + primary button behavior when `linked.length > 1`.
4. **Polish:** Card layout (approach B), preferences for default account, last sync time.

---

## 7. Open questions

1. Should **Google Cloud Console** use **one** OAuth client for all links (same redirect URI) — **yes, recommended** — with `account_label` only in MeOS state?
2. Max number of linked accounts per user (soft limit in UI)?
3. Does **sync lock** need to be per `linkedAccountId` instead of per user if we parallelize in the future? (Sequential `sync all` avoids this for MVP.)

---

## 8. References

- `web/app/settings/accounts/page.tsx`
- `web/app/api/google/link/start/route.ts`, `callback/route.ts`
- `web/lib/google-link-state-cookie.ts`, `web/lib/linked-google-accounts.ts`
- `web/app/api/calendar/sync/route.ts`, `web/app/api/calendar/linked/route.ts`
- Plan: `docs/superpowers/plans/clerk-replace-nextauth-web-login.md`
