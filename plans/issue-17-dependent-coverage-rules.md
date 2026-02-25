# Issue #17 Plan: Dependent Coverage Rules

## Source
- Issue: https://github.com/stephencweiss/me-os/issues/17
- Canonical plan comment: https://github.com/stephencweiss/me-os/issues/17#issuecomment-3959496858
- Notes: The issue thread marks an older plan as outdated and explicitly points to the canonical comment above.

## Summary
Implement dependent/correlated coverage rules so MeOS can detect source events (dates, dinner dates, trips), verify required coverage, and propose creation/updates. This plan uses explicit calendar targeting (`sourceCalendars`, `coverageSearchCalendars`, `createTarget`), event-level opt-out handling, and buffered coverage windows.

## Scope
1. Calendar-event coverage only for V1 (no external task systems).
2. Detect missing/insufficient coverage during `/calendar-manager` and `/time-report` flows.
3. Add per-event opt-out markers with description-first precedence.
4. Add lifecycle reconciliation for missing source events (orphaned coverage proposals).
5. Keep default action mode as `propose` (user confirms create/delete actions).

## Public Interfaces and Type Changes
1. Add config template: `config.example/dependencies.json`.
2. Add/extend types in `lib/calendar-manager.ts`:
- `DependencyConfig`
- `DependencyRule`
- `RuleTrigger`
- `CoverageRequirement`
- `CoverageGap`
- `CoverageActionMode`
- `CoverageOptOutConfig`
- `CoverageLifecycleAction`
- `CoverageReconciliationResult`
3. Add/extend functions in `lib/calendar-manager.ts`:
- `loadDependencyConfig()`
- `findCoverageGaps(events, rules)`
- `buildCoverageEventDraft(gap)`
- `reconcileCoverageLifecycle(events, rules, historicalLinks?)`
4. Extend `DailySummary` and `WeeklySummary` in `lib/time-analysis.ts` with coverage outputs (`coverageGaps`, lifecycle proposals).

## Explicit Rule Model
Each rule explicitly defines:
1. Where to detect source events: `trigger.sourceCalendars`
2. Where to search for existing coverage: `requirement.coverageSearchCalendars`
3. Where to create missing coverage: `requirement.createTarget.account` and `requirement.createTarget.calendar`

## Configuration Example
```json
{
  "enabled": true,
  "defaultActionMode": "propose",
  "optOut": {
    "enabled": true,
    "precedence": ["description", "title"],
    "globalTokens": ["no coverage needed", "#no-coverage"],
    "ruleScopedTokenTemplate": "no {ruleId} coverage needed"
  },
  "rules": [
    {
      "id": "babysitter-date",
      "enabled": true,
      "name": "Date requires babysitter",
      "actionMode": "propose",
      "orphanPolicy": "propose-delete",
      "trigger": {
        "sourceCalendars": ["Social"],
        "summaryPatterns": ["\\bdate\\b", "\\bdate night\\b"]
      },
      "requirement": {
        "coverageSummaryPatterns": ["babysit", "babysitter", "childcare"],
        "coverageSearchCalendars": ["Family", "Household"],
        "createTarget": {
          "account": "personal",
          "calendar": "Family"
        },
        "coverageColorId": "5",
        "windowStartOffsetMinutes": 0,
        "windowEndOffsetMinutes": 0,
        "minCoveragePercent": 100
      }
    },
    {
      "id": "babysitter-dinner-date",
      "enabled": true,
      "name": "Dinner date requires extended babysitter coverage",
      "actionMode": "propose",
      "orphanPolicy": "propose-delete",
      "trigger": {
        "sourceCalendars": ["Social"],
        "summaryPatterns": ["\\bdinner date\\b", "\\breservation\\b"]
      },
      "requirement": {
        "coverageSummaryPatterns": ["babysit", "babysitter", "childcare"],
        "coverageSearchCalendars": ["Family", "Household"],
        "createTarget": {
          "account": "personal",
          "calendar": "Family"
        },
        "coverageColorId": "5",
        "windowStartOffsetMinutes": -60,
        "windowEndOffsetMinutes": 60,
        "minCoveragePercent": 100
      }
    },
    {
      "id": "dog-care-trip",
      "enabled": true,
      "name": "Trip requires dog coverage",
      "actionMode": "propose",
      "orphanPolicy": "propose-delete",
      "trigger": {
        "sourceCalendars": ["Travel", "Primary"],
        "summaryPatterns": ["\\btrip\\b", "\\bflight\\b", "\\btravel\\b"]
      },
      "requirement": {
        "coverageSummaryPatterns": ["dog sitter", "dog care", "pet coverage"],
        "coverageSearchCalendars": ["Household", "Family"],
        "createTarget": {
          "account": "personal",
          "calendar": "Household"
        },
        "coverageColorId": "5",
        "windowStartOffsetMinutes": 0,
        "windowEndOffsetMinutes": 0,
        "minCoveragePercent": 100
      }
    }
  ]
}
```

## Decision Logic
1. Evaluate source events only from `trigger.sourceCalendars`.
2. Apply opt-out detection first (description then title):
- Global opt-out (`no coverage needed`)
- Rule-specific opt-out (`no <ruleId> coverage needed`)
3. For non-opted-out events:
- Compute required window using start/end offsets.
- Search only `coverageSearchCalendars` for candidate coverage events.
- Validate by summary patterns and overlap percentage.
4. If insufficient coverage, emit `create_missing` proposal targeting `createTarget`.
5. Reconciliation:
- If previously linked coverage remains but source no longer exists, emit `orphaned_coverage` with `propose-delete`.
- Never auto-delete in V1.

## Integration Points
1. `lib/time-analysis.ts`: include coverage findings in day/week summaries.
2. `scripts/weekly-report.ts`: add sections for missing coverage, orphaned coverage proposals, and opted-out events.
3. `.claude/skills/calendar-manager/SKILL.md`: add interactive propose/create/delete-review flow.
4. `.claude/skills/time-report/SKILL.md`: include coverage findings in report interpretation.
5. `config.example/README.md`: document explicit source/search/create calendar semantics.

## TDD Sequence
1. Config load tests (defaults, schema merging, invalid regex/tokens).
2. Trigger matching tests for `sourceCalendars` and summary patterns.
3. Coverage search/create target tests (`coverageSearchCalendars`, `createTarget`).
4. Buffer window tests (`-60/+60` dinner date scenario).
5. Opt-out precedence tests (description before title).
6. Fulfillment threshold tests (`minCoveragePercent`).
7. Duplicate-prevention tests.
8. Lifecycle reconciliation tests (source removed leads to orphan proposal).
9. Report formatting tests for new coverage sections.

## Testing Plan (Proof It Works)
1. Unit tests for dependency config load and validation:
- Missing config file produces safe no-op behavior.
- Invalid regex tokens fail with clear error messaging.
- Default action mode and opt-out precedence apply correctly.
2. Unit tests for trigger and gap detection:
- Social date without babysitter coverage yields a missing-coverage proposal.
- Dinner date 7-9 PM with -60/+60 buffer:
  - coverage 6-10 PM fulfills
  - coverage 7-9 PM does not fulfill
- Trip without dog-care coverage on allowed search calendars yields a gap.
3. Unit tests for opt-out and duplicate prevention:
- Description token (`no coverage needed`) suppresses gap creation.
- Title token only is used when description lacks opt-out markers.
- Existing valid coverage avoids duplicate proposals.
4. Unit tests for lifecycle reconciliation:
- Source event removed while linked coverage remains yields orphaned-coverage proposal.
- V1 never auto-deletes; proposals remain explicit for user confirmation.
5. Integration tests for reporting surfaces:
- `/calendar-manager` includes unresolved dependency gaps.
- `/time-report` and `scripts/weekly-report.ts` include missing coverage, orphaned coverage, and opted-out summaries.
6. Regression checks:
- Existing calendar-manager and time-report flows pass current tests unchanged when dependency config is absent.

## Assumptions and Defaults
1. Default mode remains `propose` for create/delete actions.
2. Coverage checks are case-insensitive for token/pattern matching.
3. All-day source events are out of scope for V1 unless explicitly enabled later.
4. Timezone handling follows existing Date semantics in MeOS.
