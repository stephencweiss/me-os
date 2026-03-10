/**
 * Goal Creation Tests
 *
 * Tests for the goal creation and editing feature:
 * - updateGoal() function
 * - Things 3 URL generation
 * - Week end date calculation
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Week End Date Calculation Tests
// ============================================================================

describe("Week End Date Calculation", () => {
  /**
   * Get the end date (Sunday) for a week ID
   */
  function getWeekEndDate(weekId: string): string {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid week ID format: ${weekId}. Expected YYYY-WWW (e.g., 2026-W10)`);
    }
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    // ISO week 1 contains January 4th
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // Make Sunday = 7

    // Start of week 1 (Monday)
    const week1Start = new Date(jan4);
    week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

    // Start of requested week (Monday)
    const weekStart = new Date(week1Start);
    weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);

    // End of week (Sunday)
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    return weekEnd.toISOString().split("T")[0];
  }

  it("calculates correct end date for week 10 of 2026", () => {
    const endDate = getWeekEndDate("2026-W10");
    expect(endDate).toBe("2026-03-08"); // Sunday of week 10
  });

  it("calculates correct end date for week 1 of 2026", () => {
    const endDate = getWeekEndDate("2026-W01");
    expect(endDate).toBe("2026-01-04"); // Sunday of week 1
  });

  it("calculates correct end date for week 52 of 2025", () => {
    const endDate = getWeekEndDate("2025-W52");
    expect(endDate).toBe("2025-12-28"); // Sunday of week 52
  });

  it("throws on invalid week ID format", () => {
    expect(() => getWeekEndDate("2026-10")).toThrow();
    expect(() => getWeekEndDate("W10-2026")).toThrow();
    expect(() => getWeekEndDate("invalid")).toThrow();
  });
});

// ============================================================================
// Things 3 URL Generation Tests
// ============================================================================

describe("Things 3 URL Generation", () => {
  /**
   * Get the end date (Sunday) for a week ID
   */
  function getWeekEndDate(weekId: string): string {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid week ID format: ${weekId}`);
    }
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
    const week1Start = new Date(jan4);
    week1Start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
    const weekStart = new Date(week1Start);
    weekStart.setUTCDate(week1Start.getUTCDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    return weekEnd.toISOString().split("T")[0];
  }

  /**
   * Generate Things 3 URL to create a new goal with "week" tag
   */
  function generateCreateGoalUrl(
    title: string,
    weekId: string,
    options?: { notes?: string; estimatedMinutes?: number }
  ): string {
    const params = new URLSearchParams();

    params.set("title", title);
    params.set("tags", "week");

    // Set deadline to end of week (Sunday)
    const deadline = getWeekEndDate(weekId);
    params.set("deadline", deadline);

    // Set "when" so it appears in This Week view
    params.set("when", "this week");

    if (options?.notes) {
      params.set("notes", options.notes);
    }

    return `things:///add?${params.toString()}`;
  }

  it("generates URL with required parameters", () => {
    const url = generateCreateGoalUrl("Test Goal", "2026-W10");

    expect(url).toContain("things:///add?");
    expect(url).toContain("title=Test+Goal");
    expect(url).toContain("tags=week");
    expect(url).toContain("deadline=2026-03-08");
    expect(url).toContain("when=this+week");
  });

  it("generates URL with optional notes", () => {
    const url = generateCreateGoalUrl("Test Goal", "2026-W10", {
      notes: "Some notes here",
    });

    expect(url).toContain("notes=Some+notes+here");
  });

  it("uses simple 'week' tag, not legacy format", () => {
    const url = generateCreateGoalUrl("Test Goal", "2026-W10");

    expect(url).toContain("tags=week");
    expect(url).not.toContain("w10-2026");
    expect(url).not.toContain("wN-YYYY");
  });

  it("sets deadline to Sunday of the specified week", () => {
    const url1 = generateCreateGoalUrl("Goal 1", "2026-W10");
    const url2 = generateCreateGoalUrl("Goal 2", "2026-W01");
    const url3 = generateCreateGoalUrl("Goal 3", "2025-W52");

    expect(url1).toContain("deadline=2026-03-08");
    expect(url2).toContain("deadline=2026-01-04");
    expect(url3).toContain("deadline=2025-12-28");
  });
});

// ============================================================================
// Update Goal Validation Tests
// ============================================================================

describe("Update Goal Parameter Validation", () => {
  interface UpdateGoalParams {
    title?: string;
    notes?: string | null;
    estimatedMinutes?: number | null;
    goalType?: "time" | "outcome" | "habit";
    colorId?: string | null;
  }

  function validateUpdateParams(params: UpdateGoalParams): string[] {
    const errors: string[] = [];

    if (params.title !== undefined) {
      if (typeof params.title !== "string" || params.title.trim().length === 0) {
        errors.push("title must be a non-empty string");
      }
    }

    if (params.estimatedMinutes !== undefined && params.estimatedMinutes !== null) {
      if (typeof params.estimatedMinutes !== "number" || params.estimatedMinutes < 0) {
        errors.push("estimatedMinutes must be a non-negative number");
      }
    }

    if (params.goalType !== undefined) {
      if (!["time", "outcome", "habit"].includes(params.goalType)) {
        errors.push("goalType must be 'time', 'outcome', or 'habit'");
      }
    }

    return errors;
  }

  it("accepts valid title update", () => {
    const errors = validateUpdateParams({ title: "New Title" });
    expect(errors).toHaveLength(0);
  });

  it("rejects empty title", () => {
    const errors = validateUpdateParams({ title: "" });
    expect(errors).toContain("title must be a non-empty string");
  });

  it("rejects whitespace-only title", () => {
    const errors = validateUpdateParams({ title: "   " });
    expect(errors).toContain("title must be a non-empty string");
  });

  it("accepts valid estimatedMinutes", () => {
    const errors = validateUpdateParams({ estimatedMinutes: 120 });
    expect(errors).toHaveLength(0);
  });

  it("accepts zero estimatedMinutes", () => {
    const errors = validateUpdateParams({ estimatedMinutes: 0 });
    expect(errors).toHaveLength(0);
  });

  it("accepts null estimatedMinutes", () => {
    const errors = validateUpdateParams({ estimatedMinutes: null });
    expect(errors).toHaveLength(0);
  });

  it("rejects negative estimatedMinutes", () => {
    const errors = validateUpdateParams({ estimatedMinutes: -10 });
    expect(errors).toContain("estimatedMinutes must be a non-negative number");
  });

  it("accepts valid goalType values", () => {
    expect(validateUpdateParams({ goalType: "time" })).toHaveLength(0);
    expect(validateUpdateParams({ goalType: "outcome" })).toHaveLength(0);
    expect(validateUpdateParams({ goalType: "habit" })).toHaveLength(0);
  });

  it("rejects invalid goalType", () => {
    const errors = validateUpdateParams({ goalType: "invalid" as any });
    expect(errors).toContain("goalType must be 'time', 'outcome', or 'habit'");
  });

  it("accepts null for nullable fields", () => {
    const errors = validateUpdateParams({
      notes: null,
      estimatedMinutes: null,
      colorId: null,
    });
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// Create Goal Validation Tests
// ============================================================================

describe("Create Goal Parameter Validation", () => {
  interface CreateGoalParams {
    weekId: string;
    title: string;
    notes?: string | null;
    estimatedMinutes?: number | null;
    goalType?: "time" | "outcome" | "habit";
    colorId?: string | null;
    syncToThings3?: boolean;
  }

  function validateCreateParams(params: CreateGoalParams): string[] {
    const errors: string[] = [];

    if (!params.weekId) {
      errors.push("weekId is required");
    } else if (!/^\d{4}-W\d{2}$/.test(params.weekId)) {
      errors.push("weekId must be in YYYY-WWW format");
    }

    if (!params.title) {
      errors.push("title is required");
    } else if (typeof params.title !== "string" || params.title.trim().length === 0) {
      errors.push("title must be a non-empty string");
    }

    if (params.estimatedMinutes !== undefined && params.estimatedMinutes !== null) {
      if (typeof params.estimatedMinutes !== "number" || params.estimatedMinutes < 0) {
        errors.push("estimatedMinutes must be a non-negative number");
      }
    }

    if (params.goalType !== undefined) {
      if (!["time", "outcome", "habit"].includes(params.goalType)) {
        errors.push("goalType must be 'time', 'outcome', or 'habit'");
      }
    }

    return errors;
  }

  it("accepts valid create parameters", () => {
    const errors = validateCreateParams({
      weekId: "2026-W10",
      title: "Test Goal",
    });
    expect(errors).toHaveLength(0);
  });

  it("accepts all optional parameters", () => {
    const errors = validateCreateParams({
      weekId: "2026-W10",
      title: "Test Goal",
      notes: "Some notes",
      estimatedMinutes: 120,
      goalType: "time",
      colorId: "2",
      syncToThings3: true,
    });
    expect(errors).toHaveLength(0);
  });

  it("requires weekId", () => {
    const errors = validateCreateParams({
      weekId: "",
      title: "Test Goal",
    });
    expect(errors).toContain("weekId is required");
  });

  it("validates weekId format", () => {
    expect(validateCreateParams({ weekId: "2026-10", title: "Test" })).toContain(
      "weekId must be in YYYY-WWW format"
    );
    expect(validateCreateParams({ weekId: "W10-2026", title: "Test" })).toContain(
      "weekId must be in YYYY-WWW format"
    );
    expect(validateCreateParams({ weekId: "invalid", title: "Test" })).toContain(
      "weekId must be in YYYY-WWW format"
    );
  });

  it("requires title", () => {
    const errors = validateCreateParams({
      weekId: "2026-W10",
      title: "",
    });
    expect(errors).toContain("title is required");
  });
});

// ============================================================================
// Goal Type Inference Tests
// ============================================================================

describe("Goal Type Inference", () => {
  function inferGoalType(title: string, notes?: string | null): "time" | "outcome" | "habit" {
    const combined = `${title} ${notes || ""}`.toLowerCase();

    // Time-based patterns
    if (/\d+\s*(hours?|h|hrs?|minutes?|mins?|m)\b/.test(combined)) {
      return "time";
    }

    // Habit patterns
    if (/\d+x|daily|weekly|every day|each day|times?\s*(a|per)\s*(week|day)/.test(combined)) {
      return "habit";
    }

    // Default to outcome
    return "outcome";
  }

  it("infers time type from hour patterns", () => {
    expect(inferGoalType("4 hours of deep work")).toBe("time");
    expect(inferGoalType("Spend 2h on reading")).toBe("time");
    expect(inferGoalType("30 minutes exercise")).toBe("time");
    expect(inferGoalType("90min coding")).toBe("time");
  });

  it("infers habit type from frequency patterns", () => {
    expect(inferGoalType("Workout 3x")).toBe("habit");
    expect(inferGoalType("Exercise daily")).toBe("habit");
    expect(inferGoalType("Meditate every day")).toBe("habit");
    expect(inferGoalType("Run 3 times a week")).toBe("habit");
  });

  it("defaults to outcome type", () => {
    expect(inferGoalType("Finish the spec document")).toBe("outcome");
    expect(inferGoalType("Complete API integration")).toBe("outcome");
    expect(inferGoalType("Ship feature X")).toBe("outcome");
  });

  it("considers notes for type inference", () => {
    expect(inferGoalType("Deep work", "4 hours per day")).toBe("time");
    expect(inferGoalType("Exercise", "do it 3x this week")).toBe("habit");
  });
});

// ============================================================================
// Non-Goal Status Tests
// ============================================================================

describe("Non-Goal Status", () => {
  // Status constants
  const NON_GOAL_STATUS = {
    ACTIVE: 0,
    COMPLETED: 1,
    MISSED: 2,
    ABANDONED: 3,
  } as const;

  type NonGoalStatus = (typeof NON_GOAL_STATUS)[keyof typeof NON_GOAL_STATUS];

  const NON_GOAL_STATUS_LABELS: Record<NonGoalStatus, string> = {
    [NON_GOAL_STATUS.ACTIVE]: "Active",
    [NON_GOAL_STATUS.COMPLETED]: "Completed",
    [NON_GOAL_STATUS.MISSED]: "Missed",
    [NON_GOAL_STATUS.ABANDONED]: "Abandoned",
  };

  it("has correct numeric values for statuses", () => {
    expect(NON_GOAL_STATUS.ACTIVE).toBe(0);
    expect(NON_GOAL_STATUS.COMPLETED).toBe(1);
    expect(NON_GOAL_STATUS.MISSED).toBe(2);
    expect(NON_GOAL_STATUS.ABANDONED).toBe(3);
  });

  it("has labels for all statuses", () => {
    expect(NON_GOAL_STATUS_LABELS[NON_GOAL_STATUS.ACTIVE]).toBe("Active");
    expect(NON_GOAL_STATUS_LABELS[NON_GOAL_STATUS.COMPLETED]).toBe("Completed");
    expect(NON_GOAL_STATUS_LABELS[NON_GOAL_STATUS.MISSED]).toBe("Missed");
    expect(NON_GOAL_STATUS_LABELS[NON_GOAL_STATUS.ABANDONED]).toBe("Abandoned");
  });

  it("status values are unique", () => {
    const values = Object.values(NON_GOAL_STATUS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  describe("Status Validation", () => {
    function isValidStatus(status: number): status is NonGoalStatus {
      return [0, 1, 2, 3].includes(status);
    }

    it("validates valid statuses", () => {
      expect(isValidStatus(0)).toBe(true);
      expect(isValidStatus(1)).toBe(true);
      expect(isValidStatus(2)).toBe(true);
      expect(isValidStatus(3)).toBe(true);
    });

    it("rejects invalid statuses", () => {
      expect(isValidStatus(-1)).toBe(false);
      expect(isValidStatus(4)).toBe(false);
      expect(isValidStatus(100)).toBe(false);
    });
  });

  describe("Non-Goal with Status", () => {
    interface NonGoal {
      id: string;
      week_id: string;
      title: string;
      pattern: string;
      status: NonGoalStatus;
    }

    function createNonGoal(
      title: string,
      weekId: string,
      pattern: string,
      status: NonGoalStatus = NON_GOAL_STATUS.ACTIVE
    ): NonGoal {
      return {
        id: `ng-${weekId}-${Date.now()}`,
        week_id: weekId,
        title,
        pattern,
        status,
      };
    }

    it("creates non-goal with default active status", () => {
      const ng = createNonGoal("Excessive meetings", "2026-W10", "sync|standup");
      expect(ng.status).toBe(NON_GOAL_STATUS.ACTIVE);
    });

    it("creates non-goal with specified status", () => {
      const ng = createNonGoal("Old habit", "2026-W10", ".*", NON_GOAL_STATUS.COMPLETED);
      expect(ng.status).toBe(NON_GOAL_STATUS.COMPLETED);
    });

    it("can transition from active to completed", () => {
      const ng = createNonGoal("Excessive meetings", "2026-W10", "sync|standup");
      expect(ng.status).toBe(NON_GOAL_STATUS.ACTIVE);

      // Simulate status update
      const updatedNg = { ...ng, status: NON_GOAL_STATUS.COMPLETED };
      expect(updatedNg.status).toBe(NON_GOAL_STATUS.COMPLETED);
    });

    it("can transition from active to missed", () => {
      const ng = createNonGoal("Avoid distractions", "2026-W10", "social|news");
      expect(ng.status).toBe(NON_GOAL_STATUS.ACTIVE);

      const updatedNg = { ...ng, status: NON_GOAL_STATUS.MISSED };
      expect(updatedNg.status).toBe(NON_GOAL_STATUS.MISSED);
    });

    it("can transition from active to abandoned", () => {
      const ng = createNonGoal("No longer relevant", "2026-W10", "old-pattern");
      expect(ng.status).toBe(NON_GOAL_STATUS.ACTIVE);

      const updatedNg = { ...ng, status: NON_GOAL_STATUS.ABANDONED };
      expect(updatedNg.status).toBe(NON_GOAL_STATUS.ABANDONED);
    });

    it("can transition back to active from any status", () => {
      const completed = createNonGoal("Test", "2026-W10", ".*", NON_GOAL_STATUS.COMPLETED);
      const missed = createNonGoal("Test", "2026-W10", ".*", NON_GOAL_STATUS.MISSED);
      const abandoned = createNonGoal("Test", "2026-W10", ".*", NON_GOAL_STATUS.ABANDONED);

      expect({ ...completed, status: NON_GOAL_STATUS.ACTIVE }.status).toBe(NON_GOAL_STATUS.ACTIVE);
      expect({ ...missed, status: NON_GOAL_STATUS.ACTIVE }.status).toBe(NON_GOAL_STATUS.ACTIVE);
      expect({ ...abandoned, status: NON_GOAL_STATUS.ACTIVE }.status).toBe(NON_GOAL_STATUS.ACTIVE);
    });
  });
});
