---
status: ACTIVE
created: 2026-03-19
jj_workspace: mobile-alignment-mvp
jj_bookmark: mobile-alignment-mvp
---

# Build plan: Mobile alignment MVP (Phase 1)

**Intent:** Executable checklist for the **Phase 1 “alignment mobile”** product described in [PR #91](https://github.com/stephencweiss/me-os/pull/91) (merged): goals ↔ calendar truth, weekly audit (E3), versioned DTOs (E2), per-goal windows (E4). **Slot-finder + widget stay Phase 2** — do not block MVP on them.

**Canonical strategy docs** (ensure they exist on your branch after rebasing on `main`; filenames may vary if docs moved):

- `plans/ceo-mobile-goal-alignment.md` — phased scope, “alignment first”
- `plans/eng-review-mobile-goal-alignment-phase1.md` — locked APIs, auth tracks, tests

**jj isolation for this line of work**

- **Workspace** (`jj workspace add`): second checkout directory sharing the same `.jj` repo — same idea as a **git worktree**, but jj-native.
- **Bookmark** (`jj bookmark create` / `jj bookmark set`): jj’s name for a **movable named pointer to a commit** (closest analogue to a **git branch**). Use it to name this line of development and to push/fetch with the Git backend.

This folder was created as jj workspace **`mobile-alignment-mvp`** with bookmark **`mobile-alignment-mvp`** at `../worktrees/me-os/mobile-alignment-mvp` (see `jj workspace list`).

---

## MVP definition (ship criteria)

1. **One-week alignment view** — goals with minutes vs target and honest **empty / stale / unknown** states (no silent success on errors).
2. **`GET /api/week-alignment?week=YYYY-Www`** — single aggregation endpoint; response matches **`schemas/alignment-mobile-v1.json`** (or equivalent generated JSON Schema kept in sync with TS types).
3. **Weekly audit persistence (E3)** — table such as `weekly_audit_state`: `user_id`, `week_id`, `dismissed_at`, `snoozed_until`, `prompt_count`, `last_prompt_at`; POST (or PATCH) for dismiss/snooze with **idempotence / conflict policy documented**.
4. **E4 groundwork** — `constraints_json` on `weekly_goals` (shared shape with Phase 2 slot work); **defaults** OK until UI edits constraints; alignment scoring respects per-goal windows when present.
5. **Auth path (default)** — **Track A or B** first: responsive web or Capacitor/WebView using existing **NextAuth + Google** cookies; **401 → explicit re-sign-in**, never an empty “logged-in” shell. **Track C** (native Bearer) only after a deliberate spike.
6. **Tests** — unit tests for `buildAlignmentMobileV1` (empty, full, stale hint); integration tests for `GET /api/week-alignment` (401, 400 bad week, 200 shape); audit state transitions + backoff.

**Explicitly out of MVP:** slot-finder API, widget, APNs, Android, LLM parsing.

---

## Implementation order (suggested)

| Step | Deliverable | Notes |
|------|-------------|--------|
| 0 | **Rebase / sync `main`** | Pull merged PR #91 docs if missing locally; resolve `main` bookmark conflicts in jj if any before large work. |
| 1 | **`schemas/alignment-mobile-v1.json`** | `schemaVersion`, `weekId`, `generatedAt`, `goals[]`, `syncHint`, audit eligibility flags — contract before heavy UI. |
| 2 | **Migrations** | `weekly_audit_state`; `constraints_json` on `weekly_goals` if not present; mirror in Supabase types workflow. |
| 3 | **`lib/goal-constraints.ts`** | Single module for constraints shape; consumed later by Phase 2 slot-finder. |
| 4 | **`lib/week-alignment.ts`** | `buildAlignmentMobileV1(...)` — reuse `getWeekDateRange` from `lib/weekly-goals.ts`; batch progress (avoid N+1). |
| 5 | **Route** | Thin `GET /api/week-alignment` + audit **write** route; `requireAuth` + user scoping like `/api/goals`. |
| 6 | **Tests** | As in eng review + failure mode: no **200 with fabricated data** on DB errors. |
| 7 | **Client MVP** | Prefer **`/m/*` or responsive goals/alignment pages** in Next.js *or* Capacitor shell; wire audit UI + backoff copy. |
| 8 | **Design** | `docs/designs/mobile-goal-alignment.md` when IA/copy stabilizes; optional `/plan-design-review` on wireframes. |

---

## Local dev (worktree)

This checkout does **not** copy gitignored config automatically. From repo root (or main clone), when you need DB/OAuth locally:

```bash
MAIN_REPO="/Users/sweiss/code/me-os"   # or your canonical clone
cp "$MAIN_REPO/config/turso.json" ./config/ 2>/dev/null || true
cp "$MAIN_REPO/config/calendars.json" ./config/ 2>/dev/null || true
cp -r "$MAIN_REPO/config/sensitive" ./config/ 2>/dev/null || true
cp "$MAIN_REPO/webapp/.env.local" ./webapp/ 2>/dev/null || true
```

---

## Done when

- [ ] MVP rows in the table above are implemented and tested (`pnpm test`, webapp tests as applicable).
- [ ] Phase 2 items remain only in `TODOS.md` / slot eng plan — no accidental coupling in the alignment schema.
- [ ] Bookmark **`mobile-alignment-mvp`** moved with `jj bookmark move` (or `set`) as you land commits; push via your usual `jj git` flow when ready.
