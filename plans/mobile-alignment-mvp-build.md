---
status: ACTIVE
created: 2026-03-19
rebased: 2026-03-19
jj_workspace: mobile-alignment-mvp
jj_bookmark: mobile-alignment-mvp
base: origin/main (includes PR #91)
---

# Build plan: Mobile alignment MVP (Phase 1)

**Intent:** Executable checklist for the **Phase 1 “alignment mobile”** product described in [PR #91](https://github.com/stephencweiss/me-os/pull/91) (merged): goals ↔ calendar truth, weekly audit (E3), versioned DTOs (E2), per-goal windows (E4). **Slot-finder + widget stay Phase 2** — do not block MVP on them.

**Repo state (jj):** Bookmark **`mobile-alignment-mvp`** was **rebased onto `main@origin`** (merge commit for PR #91) so this line includes the CEO + Phase 1 eng plans. The conflicted jj **`main`** bookmark was pointed at **`main@origin`** to match GitHub; if your **local `git main`** has diverged (e.g. docs-only commits not on `origin/main`), reconcile with `git merge` / `git rebase` separately — this MVP branch intentionally tracks **published** `origin/main` for the alignment docs.

**Canonical strategy docs** (present on this base under `plans/`):

- `plans/ceo-mobile-goal-alignment.md` — phased scope, “alignment first”
- `plans/eng-review-mobile-goal-alignment-phase1.md` — locked APIs, auth tracks, tests

**jj isolation for this line of work**

- **Workspace** (`jj workspace add`): second checkout directory sharing the same `.jj` repo — same idea as a **git worktree**, but jj-native.
- **Bookmark** (`jj bookmark create` / `jj bookmark set`): jj’s name for a **movable named pointer to a commit** (closest analogue to a **git branch**). Use it to name this line of development and to push/fetch with the Git backend.

This folder was created as jj workspace **`mobile-alignment-mvp`** with bookmark **`mobile-alignment-mvp`** at `../worktrees/me-os/mobile-alignment-mvp` (see `jj workspace list`).

---

## Client strategy (locked — 2026-03-19)

**Ship a native iOS app (SwiftUI), not mobile web as the product.** Optimize for **polish and speed inside the Apple ecosystem**; **Android is out of scope** until deliberately revisited.

- **Main app:** SwiftUI, calling existing MeOS HTTP APIs (`/api/week-alignment`, `/api/week-alignment/audit`).
- **Auth:** Native path (**eng Track C**): sign-in on device + API/session strategy compatible with a non-browser client (not NextAuth cookies alone).
- **Widgets (Phase 2):** WidgetKit remains **Swift**; SwiftUI for the main app keeps Apple surfaces in one stack.
- **Deferred:** React Native / Expo, responsive `/m/*` “mobile website” as the primary experience, Capacitor-as-product.

Full write-up: **`docs/designs/mobile-goal-alignment.md`**.

---

## MVP definition (ship criteria)

1. **One-week alignment view** — goals with minutes vs target and honest **empty / stale / unknown** states (no silent success on errors).
2. **`GET /api/week-alignment?week=YYYY-Www`** — single aggregation endpoint; response matches **`schemas/alignment-mobile-v1.json`** (or equivalent generated JSON Schema kept in sync with TS types).
3. **Weekly audit persistence (E3)** — table such as `weekly_audit_state`: `user_id`, `week_id`, `dismissed_at`, `snoozed_until`, `prompt_count`, `last_prompt_at`; POST (or PATCH) for dismiss/snooze with **idempotence / conflict policy documented**.
4. **E4 groundwork** — `constraints_json` on `weekly_goals` (shared shape with Phase 2 slot work); **defaults** OK until UI edits constraints; alignment scoring respects per-goal windows when present.
5. **Auth path (mobile client)** — **Track C (native):** Google (or ASWebAuthenticationSession) on device + **token/session** the API accepts; **401 → explicit re-sign-in**, never an empty “logged-in” shell. (Tracks A/B remain valid for **desktop web** or internal shortcuts, not the shipped iOS app.)
6. **Tests** — unit tests for `buildAlignmentMobileV1` (empty, full, stale hint); integration tests for `GET /api/week-alignment` (401, 400 bad week, 200 shape); audit state transitions + backoff.

**Explicitly out of MVP:** slot-finder API, widget, APNs, Android, LLM parsing.

---

## Implementation order (suggested)

| Step | Deliverable | Notes |
|------|-------------|--------|
| 0 | **Branch base** | **Done:** `mobile-alignment-mvp` rebased on `main@origin` (PR #91). Re-run `jj git fetch` + rebase if `origin/main` advances. |
| 1 | **`schemas/alignment-mobile-v1.json`** | **Done** — repo root `schemas/alignment-mobile-v1.json`. |
| 2 | **Migrations** | **Done (SQL artifact)** — `supabase/migrations/00003_alignment_mobile.sql` (+ SQLite snippet in comments). Apply via `pnpm db:push` or SQL Editor; Turso auto-creates audit table on first use in local mode. |
| 3 | **`web/lib/goal-constraints.ts`** | **Done** — `parseGoalConstraints` (shared with Phase 2). |
| 4 | **`web/lib/week-alignment-core.ts` + `week-alignment.ts`** | **Done** — pure DTO builder + `loadWeekAlignmentMobileV1`; `getWeekDateRange` via `db-unified`; batch progress `getGoalProgressMinutesBatch`. |
| 5 | **Route** | **Done** — `GET /api/week-alignment`, `POST /api/week-alignment/audit` (`dismiss` \| `snooze` \| `seen`). |
| 6 | **Tests** | **Partial** — `web/lib/week-alignment.test.ts` (core + audit + constraints). Add route integration tests when harness exists. |
| 7 | **iOS client MVP** | **SwiftUI** app: week alignment from `AlignmentMobileV1`, audit flow (dismiss / snooze / seen), honest sync/empty states; wire to APIs above. |
| 8 | **Design** | **`docs/designs/mobile-goal-alignment.md`** (client strategy + references). Add wireframes/IA when ready; optional `/plan-design-review`. |

---

## Local dev (worktree)

**Full local test playbook (directory, install, env, migration, curl/browser, PR push):**  
`docs/testing/week-alignment-local.md`

This checkout does **not** copy gitignored config automatically. From repo root (or main clone), when you need DB/OAuth locally:

```bash
MAIN_REPO="/Users/sweiss/code/me-os"   # or your canonical clone
cp "$MAIN_REPO/config/turso.json" ./config/ 2>/dev/null || true
cp "$MAIN_REPO/config/calendars.json" ./config/ 2>/dev/null || true
cp -r "$MAIN_REPO/config/sensitive" ./config/ 2>/dev/null || true
cp "$MAIN_REPO/web/.env.local" ./web/ 2>/dev/null || true
```

---

## Done when

- [ ] MVP rows in the table above are implemented and tested (`pnpm test`, webapp tests as applicable).
- [ ] Phase 2 items remain only in `TODOS.md` / slot eng plan — no accidental coupling in the alignment schema.
- [ ] Bookmark **`mobile-alignment-mvp`** moved with `jj bookmark move` (or `set`) as you land commits; push via your usual `jj git` flow when ready.
