import { describe, it, expect } from "vitest";
import {
  computeSyncHintFromCalendarData,
  buildAuditBlock,
  buildAlignmentMobileV1,
  CALENDAR_STALE_AFTER_MS,
  MAX_AUDIT_PROMPTS_PER_WEEK,
  type WeekAlignmentGoalRow,
} from "./week-alignment-core";
import { parseGoalConstraints } from "./goal-constraints";

function mockGoal(over: Partial<WeekAlignmentGoalRow> = {}): WeekAlignmentGoalRow {
  return {
    id: "goal-1",
    title: "Test",
    goal_type: "time",
    status: "active",
    progress_percent: 0,
    estimated_minutes: 60,
    color_id: null,
    ...over,
  };
}

describe("computeSyncHintFromCalendarData", () => {
  it("returns unknown when no timestamps", () => {
    const now = new Date("2026-03-20T12:00:00Z");
    expect(computeSyncHintFromCalendarData(null, null, now)).toBe("unknown");
  });

  it("returns stale when data is older than threshold", () => {
    const now = new Date("2026-03-20T12:00:00Z");
    const old = new Date(now.getTime() - CALENDAR_STALE_AFTER_MS - 60_000);
    expect(computeSyncHintFromCalendarData(old, null, now)).toBe("stale");
  });

  it("returns fresh when within threshold", () => {
    const now = new Date("2026-03-20T12:00:00Z");
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    expect(computeSyncHintFromCalendarData(recent, null, now)).toBe("fresh");
  });

  it("uses the newer of event vs summary timestamps", () => {
    const now = new Date("2026-03-20T12:00:00Z");
    const staleEvent = new Date(now.getTime() - CALENDAR_STALE_AFTER_MS - 60_000);
    const freshSummary = new Date(now.getTime() - 60 * 60 * 1000);
    expect(computeSyncHintFromCalendarData(staleEvent, freshSummary, now)).toBe("fresh");
  });
});

describe("buildAuditBlock", () => {
  const now = new Date("2026-03-20T12:00:00Z");

  it("eligible when no row", () => {
    const b = buildAuditBlock(null, now);
    expect(b.eligibleForPrompt).toBe(true);
    expect(b.promptCount).toBe(0);
    expect(b.maxPromptsPerWeek).toBe(MAX_AUDIT_PROMPTS_PER_WEEK);
  });

  it("not eligible when dismissed", () => {
    const b = buildAuditBlock(
      {
        dismissed_at: "2026-03-19T10:00:00Z",
        snoozed_until: null,
        prompt_count: 0,
        last_prompt_at: null,
      },
      now
    );
    expect(b.eligibleForPrompt).toBe(false);
  });

  it("not eligible when snooze active", () => {
    const b = buildAuditBlock(
      {
        dismissed_at: null,
        snoozed_until: "2026-03-21T10:00:00Z",
        prompt_count: 0,
        last_prompt_at: null,
      },
      now
    );
    expect(b.eligibleForPrompt).toBe(false);
  });

  it("not eligible when prompt cap reached", () => {
    const b = buildAuditBlock(
      {
        dismissed_at: null,
        snoozed_until: null,
        prompt_count: MAX_AUDIT_PROMPTS_PER_WEEK,
        last_prompt_at: "2026-03-18T10:00:00Z",
      },
      now
    );
    expect(b.eligibleForPrompt).toBe(false);
  });
});

describe("buildAlignmentMobileV1", () => {
  const now = new Date("2026-03-20T12:00:00Z");

  it("builds empty goals list", () => {
    const dto = buildAlignmentMobileV1({
      weekId: "2026-W12",
      generatedAt: now.toISOString(),
      goals: [],
      progressByGoalId: {},
      syncHint: "unknown",
      auditRow: null,
      now,
    });
    expect(dto.schemaVersion).toBe(1);
    expect(dto.weekId).toBe("2026-W12");
    expect(dto.goals).toEqual([]);
    expect(dto.syncHint).toBe("unknown");
    expect(dto.audit.eligibleForPrompt).toBe(true);
  });

  it("maps progress minutes and constraints", () => {
    const g = mockGoal({
      id: "g1",
      constraints_json: { workingHours: { start: 9, end: 17 }, daysOfWeek: [1, 2, 3] },
    });
    const dto = buildAlignmentMobileV1({
      weekId: "2026-W12",
      generatedAt: now.toISOString(),
      goals: [g],
      progressByGoalId: { g1: 42 },
      syncHint: "fresh",
      auditRow: null,
      now,
    });
    expect(dto.goals).toHaveLength(1);
    expect(dto.goals[0].minutesLogged).toBe(42);
    expect(dto.goals[0].constraints).toEqual({
      workingHours: { start: 9, end: 17 },
      daysOfWeek: [1, 2, 3],
    });
  });
});

describe("parseGoalConstraints", () => {
  it("returns null for invalid JSON string", () => {
    expect(parseGoalConstraints("{")).toBeNull();
  });

  it("accepts valid JSON string", () => {
    expect(
      parseGoalConstraints('{"workingHours":{"start":10,"end":16},"daysOfWeek":[1]}')
    ).toEqual({ workingHours: { start: 10, end: 16 }, daysOfWeek: [1] });
  });
});
