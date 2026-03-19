# Engineering review: Mobile goal alignment — Phase 1

**Generated:** 2026-03-19 (`/plan-eng-review`, post–CEO amendment)  
**Branch:** `main` | **Repo:** me-os  
**Inputs:** `plans/ceo-mobile-goal-alignment.md`, `TODOS.md`, existing webapp (`/api/goals`, `db-unified`, NextAuth)

**Mode:** `FULL_REVIEW` — Phase 1 decisions **locked** unless reopened. **Phase 2** slot-finder remains specified in `plans/eng-review-slot-finder-2026-03-19.md`.

---

## Step 0 — Scope challenge

### What already exists (reuse aggressively)

| Capability | Location | Phase 1 use |
|------------|----------|-------------|
| Weekly goals + progress | `GET /api/goals`, `getGoalProgressMinutes`, `db-unified` | Core alignment data |
| Events / summaries | `GET /api/events`, `GET /api/summaries`, `db-unified` | “What the calendar showed” |
| Auth (web) | NextAuth + Google, `requireAuthUnlessLocal()` | Same user id as APIs |
| Goal types, status | `StoredWeeklyGoal`, `WeeklyGoals.tsx` patterns | Mobile presents same model |
| Non-goals / alerts | existing APIs + tables | Optional Phase 1.1 |

**Do not build:** a second goals database, a full calendar editor, or slot math in Phase 1.

### Minimum shippable slice (Phase 1)

1. **Mobile-shaped UX** for **one week**: list goals + minutes logged vs target + simple “alignment” copy (honest empty/stale states).  
2. **E3 persistence:** `weekly_audit_state` (or equivalent) — `user_id`, `week_id`, `dismissed_at`, `snoozed_until`, `prompt_count`, `last_prompt_at`.  
3. **E2 (Phase 1):** **`schemas/alignment-mobile-v1.json`** — versioned DTO for what the client needs: `schemaVersion`, `weekId`, `generatedAt`, `goals[]`, `syncHint` (fresh/stale/unknown), `audit` eligibility flags. Native and web-mobile share it.  
4. **E4:** `constraints_json` on `weekly_goals` (or same shape as Phase 2 eng plan) so “alignment” isn’t scored against the wrong hours — **same migration as slot plan**; if you ship web-only first, **defaults** can suffice until column lands.  
5. **One aggregation route** e.g. `GET /api/week-alignment?week=YYYY-Www` returning JSON **validated** against the schema (or TS builder + JSON Schema kept in sync).  
6. **Auth path for native (explicit):** see **Architecture → Auth** — do **not** pretend `httpOnly` cookies work in SwiftUI without a bridge.

### Complexity check

Target **≤8 touched areas**: migration (if E4), `db-unified` + Supabase mirror, one new route, one builder module (`lib/week-alignment.ts`), schema file, tests, mobile or web client slice. If native auth explodes scope, **ship web-mobile first** in the same PR family.

### TODOS cross-reference

- E1 / E5 / slot-specific work stay **Phase 2** (`TODOS.md` + slot eng plan).  
- `DESIGN.md` still optional until UI stabilizes.

---

## 1. Architecture review

### Data flow (Phase 1)

```
[Client: Safari / Capacitor / SwiftUI]
        │ HTTPS + auth (see below)
        ▼
 GET /api/week-alignment?week=…
        │
        ├── db-unified: goals for week + progress minutes
        ├── db-unified: events or summaries for range
        └── DB: weekly_audit_state (read/write for audit actions)
        ▼
 lib/week-alignment.ts  →  AlignmentMobileV1 DTO  →  JSON response
```

### Auth (**locked strategy — pick one track; default stated**)

**Problem:** NextAuth today is **cookie-session** oriented (`requireAuth()` in API routes). Pure native apps do not get those cookies for free.

| Track | What it is | Phase 1 fit |
|-------|------------|-------------|
| **A — Mobile web (default start)** | Responsive routes or `/m/*` in Next.js; user signs in with existing **Google + NextAuth** in Safari | **Fastest** validation of alignment UX; **zero** new auth server code |
| **B — Capacitor / WebView shell** | Hosted webapp inside wrapper; session cookies live in WebView | **“App on home screen”** with minimal native code; still web tech |
| **C — Native SwiftUI** | Needs **Bearer token** (or Supabase session) usable on `Authorization` header from API routes | **Requires new auth work**: token exchange, refresh, secure storage — **spike before promising week-one SwiftUI** |

**RECOMMENDATION (lake vs ocean):** **Ship Track A or B first** so E3 + alignment ship on real data; **spike Track C** in parallel only if “native” is non-negotiable for dogfooding. **Maps to CEO Approach A/B** (alignment-first).

**Production failure scenario:** User opens app, session expired → **401** → must see **Re-sign in** with **no silent empty dashboard**. Test required.

### Security

- All new routes: **`requireAuth`** + `userId` scoping — same as `/api/goals`.  
- No cross-user reads on `weekly_audit_state`.  
- Alignment DTO must not leak other users’ data (obvious, but enforce in integration tests).

---

## 2. Code quality review

- **Single builder** `buildAlignmentMobileV1(...)` in `lib/week-alignment.ts` — route stays thin (**explicit > clever**).  
- **DRY:** Reuse `getWeekDateRange` from `lib/weekly-goals.ts` for bounds; do not duplicate ISO week math.  
- **DRY with Phase 2:** `constraints_json` shape **one module** `lib/goal-constraints.ts` consumed by Phase 2 slot-finder and Phase 1 alignment scoring.

---

## 3. Test review

### Branch / outcome diagram

```
week-alignment GET ──unauth──▶ 401
                 ──bad week──▶ 400
                 ──ok────────▶ 200 + DTO
audit POST snooze ──ok──────▶ persisted snoozed_until
                 ──conflict──▶ idempotent or 409 (pick one; document)
constraints_json ──invalid───▶ goal save 400 (when E4 enforced)
```

| New codepath | Test |
|--------------|------|
| `buildAlignmentMobileV1` | Unit: empty goals, full goals, stale sync hint |
| `GET /api/week-alignment` | Integration: auth, week validation, shape matches schema |
| Audit state transitions | Unit: dismiss, snooze, backoff counter |

**LLM:** Phase 1 alignment is **not** LLM-driven; no prompt eval scope.

---

## Test plan artifact pointer

Written to: `~/.gstack/projects/stephencweiss-me-os/sweiss-main-test-plan-20260319-134902-alignment.md`.

---

## 4. Performance review

- **One** goals fetch + **one** events/summaries fetch per alignment request — no N+1 per goal on this route (progress can be aggregated in SQL or batched; **avoid** `getGoalProgressMinutes` × N if slow).  
- Cache headers optional (`private, max-age=60`) after profiling.

---

## NOT in scope (Phase 1)

- Slot-finder, slot widget payload (Phase 2).  
- APNs (defer; in-app/web audit first).  
- Android.  
- LLM parsing of goals.

---

## What already exists (summary)

Next.js webapp with Google OAuth, goals APIs, events/summaries — **alignment is composition + audit state + contract**, not greenfield.

---

## Failure modes

| Failure | User | Test | Handling |
|---------|------|------|----------|
| Stale calendar | “Data may be outdated” | Yes | `syncHint` in DTO |
| No goals | Warm CTA | Yes | Empty `goals[]` + copy |
| Auth expired | Sign in | Yes | 401 → client flow |
| Audit spam | Backoff | Yes | `prompt_count` + cap |

**Critical gap if:** 200 OK with fabricated progress when DB errors — **must** 5xx or explicit error field.

---

## Locked decisions (Phase 1)

| Topic | Decision |
|-------|----------|
| CEO ordering | Alignment Phase 1; slot Phase 2 |
| E2 split | `alignment-mobile-v1` schema **first** |
| E3 | Dedicated audit state table |
| E4 | Shared `constraints_json` with Phase 2 |
| Auth | Default **web-mobile or Capacitor**; native SwiftUI **after** token spike |
| Slot eng doc | Still valid for Phase 2; ordering supersession note at top |

---

## Completion summary

| Item | Result |
|------|--------|
| Step 0 | Scope = alignment + audit + contract + optional E4 |
| Architecture | 1 diagram; auth split A/B/C |
| Code quality | Builder module + shared constraints |
| Tests | Unit + integration listed |
| Performance | Single-fetch guidance |
| NOT in scope | Written |
| Failure modes | No silent success on DB error |
| Lake score | Prefer complete tests + honest auth story |

**Next:** `/plan-design-review` for alignment IA (when you have **screens** — see below). Then implement Track A/B, then C if needed.

---

## Note: “Screens” and `/plan-design-review`

**Screens** means **any stable visual spec**: low-fi **wireframes**, **Figma mockups**, or **implemented UI**. Design review can run on mockups **before** code (plan mode) or on the **running app** after implementation; mockups are enough to lock IA, states, and copy.
