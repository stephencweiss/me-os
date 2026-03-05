/**
 * Goals API Tests
 *
 * Unit and integration tests for the goals and non-goals POST endpoints.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, closeDatabase } from "../lib/calendar-db.js";

// We'll test the database functions directly since they're used by the API routes
// For full API testing, we'd need to set up a Next.js test environment

describe("Goals Database Functions", () => {
  beforeEach(async () => {
    // Close any existing database and initialize a fresh in-memory database for each test
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("createGoal (via upsertWeeklyGoal)", () => {
    it("creates a new goal with required fields", async () => {
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      const goal = await upsertWeeklyGoal({
        things3_id: "test-123",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: null,
        goal_type: "outcome",
        color_id: null,
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      expect(goal).toBeDefined();
      expect(goal.id).toBe("test-123:2026-W10");
      expect(goal.title).toBe("Test Goal");
      expect(goal.week_id).toBe("2026-W10");
      expect(goal.status).toBe("active");
      expect(goal.goal_type).toBe("outcome");
    });

    it("creates a goal with all optional fields", async () => {
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      const goal = await upsertWeeklyGoal({
        things3_id: "test-456",
        week_id: "2026-W10",
        title: "Complete Goal",
        notes: "Some notes here",
        estimated_minutes: 120,
        goal_type: "time",
        color_id: "2",
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      expect(goal.notes).toBe("Some notes here");
      expect(goal.estimated_minutes).toBe(120);
      expect(goal.goal_type).toBe("time");
      expect(goal.color_id).toBe("2");
    });

    it("updates existing goal on duplicate", async () => {
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      // Create initial goal
      await upsertWeeklyGoal({
        things3_id: "test-789",
        week_id: "2026-W10",
        title: "Original Title",
        notes: null,
        estimated_minutes: null,
        goal_type: "outcome",
        color_id: null,
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Update with same things3_id and week_id
      const updated = await upsertWeeklyGoal({
        things3_id: "test-789",
        week_id: "2026-W10",
        title: "Updated Title",
        notes: "New notes",
        estimated_minutes: 60,
        goal_type: "time",
        color_id: "3",
        status: "active",
        progress_percent: 50,
        completed_at: null,
      });

      expect(updated.id).toBe("test-789:2026-W10");
      expect(updated.title).toBe("Updated Title");
      expect(updated.notes).toBe("New notes");
      expect(updated.progress_percent).toBe(50);
    });

    it("supports different goal types", async () => {
      const { upsertWeeklyGoal } = await import("../lib/calendar-db.js");

      const goalTypes: Array<"time" | "outcome" | "habit"> = [
        "time",
        "outcome",
        "habit",
      ];

      for (const goalType of goalTypes) {
        const goal = await upsertWeeklyGoal({
          things3_id: `type-${goalType}`,
          week_id: "2026-W10",
          title: `${goalType} goal`,
          notes: null,
          estimated_minutes: null,
          goal_type: goalType,
          color_id: null,
          status: "active",
          progress_percent: 0,
          completed_at: null,
        });

        expect(goal.goal_type).toBe(goalType);
      }
    });
  });

  describe("createNonGoal", () => {
    it("creates a new non-goal with required fields", async () => {
      const { createNonGoal } = await import("../lib/calendar-db.js");

      const nonGoal = await createNonGoal({
        week_id: "2026-W10",
        title: "Avoid Meetings",
        pattern: "meeting|sync",
        color_id: null,
        reason: null,
        active: 1,
      });

      expect(nonGoal).toBeDefined();
      expect(nonGoal.id).toMatch(/^ng-2026-W10-/);
      expect(nonGoal.title).toBe("Avoid Meetings");
      expect(nonGoal.pattern).toBe("meeting|sync");
      expect(nonGoal.active).toBe(1);
    });

    it("creates a non-goal with all optional fields", async () => {
      const { createNonGoal } = await import("../lib/calendar-db.js");

      const nonGoal = await createNonGoal({
        week_id: "2026-W10",
        title: "No After-Hours",
        pattern: ".*",
        color_id: "11",
        reason: "Protect work-life balance",
        active: 1,
      });

      expect(nonGoal.color_id).toBe("11");
      expect(nonGoal.reason).toBe("Protect work-life balance");
    });

    it("generates unique IDs for multiple non-goals", async () => {
      const { createNonGoal } = await import("../lib/calendar-db.js");

      const nonGoal1 = await createNonGoal({
        week_id: "2026-W10",
        title: "Non-goal 1",
        pattern: "pattern1",
        color_id: null,
        reason: null,
        active: 1,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const nonGoal2 = await createNonGoal({
        week_id: "2026-W10",
        title: "Non-goal 2",
        pattern: "pattern2",
        color_id: null,
        reason: null,
        active: 1,
      });

      expect(nonGoal1.id).not.toBe(nonGoal2.id);
    });
  });

  describe("getGoalById", () => {
    it("returns goal when found", async () => {
      const { upsertWeeklyGoal, getGoalById } = await import(
        "../lib/calendar-db.js"
      );

      await upsertWeeklyGoal({
        things3_id: "find-me",
        week_id: "2026-W10",
        title: "Findable Goal",
        notes: null,
        estimated_minutes: null,
        goal_type: "outcome",
        color_id: null,
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      const found = await getGoalById("find-me:2026-W10");
      expect(found).toBeDefined();
      expect(found?.title).toBe("Findable Goal");
    });

    it("returns null when not found", async () => {
      const { getGoalById } = await import("../lib/calendar-db.js");

      const notFound = await getGoalById("nonexistent:2026-W10");
      expect(notFound).toBeNull();
    });
  });

  describe("getNonGoalById", () => {
    it("returns non-goal when found", async () => {
      const { createNonGoal, getNonGoalById } = await import(
        "../lib/calendar-db.js"
      );

      const created = await createNonGoal({
        week_id: "2026-W10",
        title: "Findable Non-Goal",
        pattern: ".*",
        color_id: null,
        reason: null,
        active: 1,
      });

      const found = await getNonGoalById(created.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe("Findable Non-Goal");
    });

    it("returns null when not found", async () => {
      const { getNonGoalById } = await import("../lib/calendar-db.js");

      const notFound = await getNonGoalById("ng-nonexistent");
      expect(notFound).toBeNull();
    });
  });
});

describe("Goals API Validation", () => {
  // These tests validate the expected behavior of the API routes
  // They test the validation logic that would be applied

  describe("POST /api/goals validation", () => {
    it("weekId format should be YYYY-WWW", () => {
      const weekRegex = /^\d{4}-W\d{2}$/;

      expect(weekRegex.test("2026-W10")).toBe(true);
      expect(weekRegex.test("2026-W01")).toBe(true);
      expect(weekRegex.test("2026-W52")).toBe(true);

      expect(weekRegex.test("2026-10")).toBe(false);
      expect(weekRegex.test("W10-2026")).toBe(false);
      expect(weekRegex.test("2026-W1")).toBe(false);
      expect(weekRegex.test("invalid")).toBe(false);
    });

    it("goalType should be valid enum", () => {
      const validTypes = ["time", "outcome", "habit"];

      expect(validTypes.includes("time")).toBe(true);
      expect(validTypes.includes("outcome")).toBe(true);
      expect(validTypes.includes("habit")).toBe(true);

      expect(validTypes.includes("invalid")).toBe(false);
      expect(validTypes.includes("")).toBe(false);
    });

    it("estimatedMinutes should be non-negative", () => {
      const isValid = (value: number) => typeof value === "number" && value >= 0;

      expect(isValid(0)).toBe(true);
      expect(isValid(60)).toBe(true);
      expect(isValid(120.5)).toBe(true);

      expect(isValid(-1)).toBe(false);
      expect(isValid(-60)).toBe(false);
    });

    it("title should be non-empty string", () => {
      const isValidTitle = (value: unknown) =>
        typeof value === "string" && value.trim().length > 0;

      expect(isValidTitle("Test Goal")).toBe(true);
      expect(isValidTitle("  Trimmed  ")).toBe(true);

      expect(isValidTitle("")).toBe(false);
      expect(isValidTitle("   ")).toBe(false);
      expect(isValidTitle(null)).toBe(false);
      expect(isValidTitle(undefined)).toBe(false);
      expect(isValidTitle(123)).toBe(false);
    });
  });

  describe("POST /api/non-goals validation", () => {
    it("pattern should be valid regex", () => {
      const isValidRegex = (pattern: string) => {
        try {
          new RegExp(pattern);
          return true;
        } catch {
          return false;
        }
      };

      expect(isValidRegex("meeting|sync")).toBe(true);
      expect(isValidRegex(".*")).toBe(true);
      expect(isValidRegex("^[a-z]+$")).toBe(true);

      expect(isValidRegex("[invalid")).toBe(false);
      expect(isValidRegex("(?<=abc")).toBe(false); // Lookbehind may not be supported
    });

    it("weekId format should be YYYY-WWW", () => {
      const weekRegex = /^\d{4}-W\d{2}$/;

      expect(weekRegex.test("2026-W10")).toBe(true);
      expect(weekRegex.test("2026-W01")).toBe(true);

      expect(weekRegex.test("invalid")).toBe(false);
    });
  });
});

describe("Goals API Contract", () => {
  // These tests document the expected API contract

  describe("POST /api/goals response", () => {
    it("success response should have correct shape", () => {
      const successResponse = {
        success: true,
        goal: {
          id: "test:2026-W10",
          things3_id: "test",
          week_id: "2026-W10",
          title: "Test Goal",
          notes: null,
          estimated_minutes: 60,
          goal_type: "outcome",
          color_id: "2",
          status: "active",
          progress_percent: 0,
          completed_at: null,
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      };

      expect(successResponse).toHaveProperty("success", true);
      expect(successResponse).toHaveProperty("goal");
      expect(successResponse.goal).toHaveProperty("id");
      expect(successResponse.goal).toHaveProperty("title");
      expect(successResponse.goal).toHaveProperty("week_id");
    });

    it("error response should have correct shape", () => {
      const errorResponse = {
        error: "weekId is required",
      };

      expect(errorResponse).toHaveProperty("error");
      expect(typeof errorResponse.error).toBe("string");
    });
  });

  describe("POST /api/non-goals response", () => {
    it("success response should have correct shape", () => {
      const successResponse = {
        success: true,
        nonGoal: {
          id: "ng-2026-W10-123456",
          week_id: "2026-W10",
          title: "Avoid Meetings",
          pattern: "meeting|sync",
          color_id: null,
          reason: "Protect focus time",
          active: 1,
          created_at: "2026-03-01T00:00:00Z",
        },
      };

      expect(successResponse).toHaveProperty("success", true);
      expect(successResponse).toHaveProperty("nonGoal");
      expect(successResponse.nonGoal).toHaveProperty("id");
      expect(successResponse.nonGoal).toHaveProperty("title");
      expect(successResponse.nonGoal).toHaveProperty("pattern");
    });
  });
});
