# Engineering review: Slot finder + widget contract + weekly audit

**Generated:** 2026-03-19 (`/plan-eng-review`)  
**Branch:** `main` | **Repo:** me-os  
**Inputs:** CEO plan `~/.gstack/projects/stephencweiss-me-os/ceo-plans/2026-03-19-meos-ios-widget-slot-finder.md`, `docs/designs/slot-finder-widget.md`, `TODOS.md`

**Mode:** `FULL_REVIEW` — decisions below are **locked for implementation** unless you explicitly reopen them.

---

## Step 0 — Scope challenge

### What already exists (reuse; do not rebuild)

| Capability | Location | Use for this effort |
|------------|----------|---------------------|
| Gap / flex slot math | `calculateFlexSlots()` in `lib/calendar-manager.ts` | Turn synced events → candidate gaps inside waking hours |
| Slot allocation for a structured time goal | `findSlotsForGoal()`, `filterSlotsBySchedule()` in `lib/calendar-optimizer.ts` | Deterministic placement; same algorithms as `/calendar-optimizer` skill |
| Weekly goal records | `StoredWeeklyGoal` in `lib/calendar-db.ts`, CRUD via `webapp/lib/db-unified.ts` | Source of duration, type, color, progress |
| Events for a range | `getEvents()` in `webapp/lib/db-unified.ts` | Single fetch per slot-finder request |
| Auth on API routes | `requireAuthUnlessLocal()` | All new routes stay tenant-scoped |
| Optimizer-shaped goal view | `getGoalsForOptimizer()` in `lib/weekly-goals.ts` | Pattern for mapping DB goal → `TimeGoal`-like input |

### Minimum shippable slice (week one)

1. **Versioned JSON Schema** for widget/web payload (**E2**).  
2. **Pure `lib/slot-finder.ts`** (or adjacent name) that composes DB events + goal row → DTO matching schema.  
3. **One authenticated API route** returning that DTO (no Swift in the first PR).  
4. **Minimal web surface**: “Find time” from `WeeklyGoals` → page or panel that calls the route.  
5. **E4** data model + migration for per-goal (or per–goal-type default + override) working windows.  
6. **E3** vertical: persist dismiss/snooze + one in-app audit surface; **defer APNs** to a follow-up unless you already have push infra.

This matches CEO **Approach B discipline** with **Approach A’s** first slice.

### Complexity check

A naive implementation could touch **10+ files** (DB migration, unified DB, API, UI, schema, tests). That is acceptable if **behavior stays in one pure module** and the API is a thin wrapper — avoid spinning a separate “slot-finder service” repo.

### TODOS.md cross-reference

| Item | Blocks v1? |
|------|------------|
| E1 “Why this slot?” | No — optional field later |
| E5 widget stale/offline | No — document `generatedAt` + `stale` policy in schema |
| DESIGN.md | No — follow existing Tailwind/Button patterns |
| E6 design doc | Closed — `docs/designs/slot-finder-widget.md` exists |

### Completeness (lake)

With CC-assisted dev, prefer **full tests for pure slot-finder logic** and **API contract tests** over shipping only happy-path. Edge cases (no gaps, TZ boundaries, empty week) are cheap to cover.

---

## Locked architecture

### Data flow

```
                    ┌─────────────────────┐
                    │  GET /api/.../slots │
                    │  (Next.js, authed)  │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  db-unified.getEvents   db-unified.getGoal*   preferences /
  (date range)           (goalId + week)        constraints row
         │                     │
         └──────────┬──────────┘
                    ▼
            lib/slot-finder.ts
            (map events → CalendarEvent,
             flex slots → findSlotsForGoal)
                    │
                    ▼
         WidgetPayloadV1 (JSON Schema)
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   Web UI                 iOS widget (later)
```

### E2 — JSON Schema ownership (**locked**)

- **Canonical artifact:** `schemas/widget-payload-v1.json` at repo root (or `docs/schemas/` if you prefer docs colocation — **pick one directory and never duplicate**).  
- **TypeScript:** export matching types from `lib/widget-payload-v1.ts` (hand-written or `json-schema-to-typescript` in dev — avoid runtime codegen in hot path).  
- **OpenAPI:** optional later — if you add `openapi.yaml`, **import or `$ref` the same file**; do not fork the shape.

**Payload must include:** `schemaVersion`, `generatedAt` (ISO), `timezone` (IANA string), `goal` summary, `bestToday` nullable slot, `byDay[]` (7 entries or sparse + explicit `date`), `remainingMinutesWeek`, optional `alternates[]` (cap N).  
**E5 prep:** boolean or enum `dataStatus: "fresh" | "unknown"` until refresh story exists.

### E4 — Per-goal working hours (**locked**)

- Add **`constraints_json`** (TEXT) on `weekly_goals` (Turso) with mirrored column on Supabase `weekly_goals` — **one extension point** for `workingHours: { start, end }`, `daysOfWeek: number[]`, future fields.  
- **Defaults:** if null, derive from `goal_type` (e.g. `habit` → wider window, `time` → workday default) in one function `defaultConstraintsForGoalType()` so behavior is explicit and testable.  
- **Single global schedule** in `lib/schedule.json` / `loadSchedule()` remains a **fallback only**, not the primary source for protected goals once constraints exist.

**Migration:** additive column + backfill nulls; no removal of existing columns in the same PR.

### E3 — Weekly audit (**locked**)

- **Persistence:** new table `weekly_audit_state` (or reuse `user_preferences` with structured keys if you strongly prefer minimal schema — **recommend dedicated table** for `user_id`, `week_id`, `dismissed_at`, `snoozed_until`, `prompt_count`).  
- **Trigger (v1):** **in-app** when user opens app during audit window (e.g. Sun PM–Mon) **or** manual “Weekly review” entry; **no APNs dependency** in the first merge.  
- **UX:** single sheet/modal: summary + Dismiss / Snooze 3d / Open slot finder (matches design doc).  
- **Backoff:** if `prompt_count` high with no engagement, stop prompting that week (CEO failure-mode table).

### Entry route (**locked**)

- **Primary:** `WeeklyGoals` row action **“Find time”** deep-links to `/goals/[goalId]/slots?week=YYYY-Www` (or query `goalId` on a dedicated route).  
- **No separate `/protect` route in v1** unless it is a **302 to the same component** — avoids two UX paths.

### “Open in Calendar” (**locked**)

- **v1:** **Google Calendar URL** for the suggested start time (`https://calendar.google.com/calendar/render?action=TEMPLATE&...`) plus copy-friendly ISO range in API for widget.  
- **Not** ICS generation in v1 (adds MIME/download UX debt).

---

## Code quality expectations

- **DRY:** All gap and allocation logic lives in **`lib/slot-finder.ts` + existing `calendar-manager` / `calendar-optimizer`** — no second copy of flex math in the API route.  
- **Explicit:** One function `buildWidgetPayloadV1(input): WidgetPayloadV1` that is easy to unit test.  
- **Minimal diff:** API route delegates; no new abstraction layer (“SlotFinderServiceFactory”) unless a second consumer appears.

### Adapter: DB goal → `TimeGoal`

Map `StoredWeeklyGoal` → optimizer `TimeGoal`:

- `totalMinutes` / `remainingMinutes` from `estimated_minutes` and progress (reuse patterns from `getGoalsForOptimizer`).  
- `minSessionMinutes` / `maxSessionMinutes` / `sessionsPerWeek`: **optional columns in `constraints_json`** with conservative defaults (e.g. 30 / 120 / 1) until UI exposes them.  
- `context`: derive from `goal_type` or constraints, not hard-coded.

---

## Test plan (summary)

**Diagram — branches to cover**

```
getEvents ──empty──▶ no flex slots ──▶ empty proposal + clear message
        └──events──▶ calculateFlexSlots ──▶ findSlotsForGoal
                      ├── remainingMinutes satisfied → proposals
                      ├── gaps too small → []
                      └── schedule filter clips all → []
constraints_json ──invalid JSON──▶ validation error (400), never throw 500 silent
API ──unauth (non-local)──▶ 401
API ──wrong user goalId──▶ 404
```

| New surface | Test type |
|-------------|-----------|
| `buildWidgetPayloadV1` / slot-finder pure fn | Unit tests with **fixture events** (in-memory) |
| Default + merged constraints | Unit tests |
| `GET .../slots` route | Integration test with mock auth (follow existing API test patterns) |
| Weekly audit state machine | Unit tests for snooze/dismiss/backoff rules |

**LLM:** This slice is **deterministic**; no new prompt paths. If you add NL constraint parsing later, follow CLAUDE.md prompt-change rules.

### Failure modes (production)

| Failure | User sees | Test? | Handled? |
|---------|-----------|-------|----------|
| Google sync stale | `dataStatus: unknown` + copy to refresh | Yes | Yes |
| No calendar data | “No events this week” / empty gaps | Yes | Yes |
| DB timeout | 500 + log | Optional | Yes |
| Invalid `constraints_json` | 400 + validation message | Yes | Yes |
| Auth expired (widget) | E5 deferred — schema reserves field | N/A | Document |

**Critical gap if:** API returns **200 with fabricated slots** when events failed to load — **must** distinguish empty vs error.

---

## Performance

- **One** `getEvents` per request for the week range; avoid per-day loops that refetch.  
- Do not N+1 on slot endpoint (unlike `GET /api/goals` enrichment pattern — slot route is single-goal).  
- Optional: short `Cache-Control: private, max-age=60` if responses are expensive — only after profiling.

---

## NOT in scope (this effort)

- E1 mandatory “why” string (optional field only if trivial).  
- E5 full stale/offline widget UX.  
- Android widget.  
- Auto-move / silent calendar writes.  
- NL-first organizer.  
- Separate microservice deployment.

---

## Implementation order (recommended)

1. `constraints_json` + migration + `db-unified` read/write.  
2. `schemas/widget-payload-v1.json` + TS types.  
3. `lib/slot-finder.ts` + unit tests.  
4. `GET /api/goals/.../slots` (exact path chosen to match existing routing style).  
5. Web UI: Find time + display JSON-shaped UI.  
6. `weekly_audit_state` + in-app audit modal.  
7. Swift widget spike consuming frozen schema (separate PR OK).

---

## Completion summary (this review)

| Item | Result |
|------|--------|
| Step 0 | **Scope accepted** — minimal slice + incremental hardening |
| Architecture | **3** tracked risks → mitigated by locks above |
| Code quality | **2** themes → DRY via shared libs; one builder function |
| Test review | Diagram + gaps listed; **critical:** load failure vs empty |
| Performance | **1** theme → single event fetch |
| NOT in scope | Written |
| What already exists | Written |
| TODOS.md | **No new required items** (optional: add “APNs for E3” when ready) |
| Failure modes | **0** silent critical gaps if error/empty contract enforced |
| Lake score | Recommend **complete** tests for pure logic + API errors |

---

## Supersedes / notes

- CEO doc **E6** deferral is **superseded** for narrative purposes by `docs/designs/slot-finder-widget.md`; keep CEO file for decision history.
