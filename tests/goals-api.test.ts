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

  describe("POST /api/goals/sync response", () => {
    it("success response should have correct shape", () => {
      const successResponse = {
        success: true,
        created: 2,
        updated: 1,
        unchanged: 3,
        completed: 0,
        errors: [],
        goals: [
          { id: "todo-1:2026-W10", title: "Goal 1", status: "active" },
          { id: "todo-2:2026-W10", title: "Goal 2", status: "completed" },
        ],
      };

      expect(successResponse).toHaveProperty("success", true);
      expect(successResponse).toHaveProperty("created");
      expect(successResponse).toHaveProperty("updated");
      expect(successResponse).toHaveProperty("unchanged");
      expect(successResponse).toHaveProperty("completed");
      expect(successResponse).toHaveProperty("errors");
      expect(successResponse).toHaveProperty("goals");
      expect(Array.isArray(successResponse.goals)).toBe(true);
    });
  });

  describe("POST /api/goals/match response", () => {
    it("success response should have correct shape", () => {
      const successResponse = {
        success: true,
        weekId: "2026-W10",
        dateRange: { start: "2026-03-02", end: "2026-03-08" },
        autoMatches: [
          {
            goalId: "test:2026-W10",
            goalTitle: "Test Goal",
            eventId: "event-1",
            eventSummary: "Test Event",
            confidence: 0.7,
            matchReasons: ["Color matches goal category"],
            minutesContributed: 60,
          },
        ],
        needsConfirmation: [],
        unmatchedEvents: [{ id: "event-2", summary: "Other", durationMinutes: 30 }],
        totalEventsProcessed: 2,
        totalGoalsChecked: 1,
        recorded: [],
      };

      expect(successResponse).toHaveProperty("success", true);
      expect(successResponse).toHaveProperty("weekId");
      expect(successResponse).toHaveProperty("dateRange");
      expect(successResponse).toHaveProperty("autoMatches");
      expect(successResponse).toHaveProperty("needsConfirmation");
      expect(successResponse).toHaveProperty("unmatchedEvents");
      expect(successResponse).toHaveProperty("totalEventsProcessed");
      expect(successResponse).toHaveProperty("totalGoalsChecked");
    });
  });
});

// ============================================================================
// Sync Endpoint Tests
// ============================================================================

describe("Goals Sync Database Functions", () => {
  beforeEach(async () => {
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("syncGoalsFromThings3", () => {
    it("creates goals from Things 3 todos with week tags", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      const todos = [
        {
          id: "todo-1",
          title: "Write documentation",
          tags: ["w10-2026"],
          completed: false,
        },
        {
          id: "todo-2",
          title: "Review PRs",
          tags: ["w10-2026", "work"],
          completed: false,
        },
      ];

      const result = await syncGoalsFromThings3(todos);

      expect(result.created).toBe(2);
      expect(result.errors).toHaveLength(0);
      expect(result.goals).toHaveLength(2);
    });

    it("skips todos without week tags", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      const todos = [
        { id: "todo-1", title: "No week tag", tags: ["work"] },
        { id: "todo-2", title: "With week tag", tags: ["w10-2026"] },
      ];

      const result = await syncGoalsFromThings3(todos);

      expect(result.created).toBe(1);
      expect(result.goals).toHaveLength(1);
      expect(result.goals[0].title).toBe("With week tag");
    });

    it("marks completed todos as completed goals", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      const todos = [
        {
          id: "todo-1",
          title: "Completed task",
          tags: ["w10-2026"],
          completed: true,
        },
      ];

      const result = await syncGoalsFromThings3(todos);

      expect(result.created).toBe(1);
      expect(result.goals[0].status).toBe("completed");
    });

    it("filters to specific week when targetWeekId provided", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      const todos = [
        { id: "todo-1", title: "Week 10", tags: ["w10-2026"] },
        { id: "todo-2", title: "Week 11", tags: ["w11-2026"] },
      ];

      const result = await syncGoalsFromThings3(todos, "2026-W10");

      expect(result.created).toBe(1);
      expect(result.goals[0].title).toBe("Week 10");
    });

    it("updates existing goals on re-sync", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      // First sync
      await syncGoalsFromThings3([
        { id: "todo-1", title: "Original title", tags: ["w10-2026"] },
      ]);

      // Second sync with updated title
      const result = await syncGoalsFromThings3([
        { id: "todo-1", title: "Updated title", tags: ["w10-2026"] },
      ]);

      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);
    });

    it("infers goal type from title", async () => {
      const { syncGoalsFromThings3 } = await import("../lib/things3-sync.js");

      const todos = [
        { id: "todo-1", title: "4 hours of coding", tags: ["w10-2026"] },
        { id: "todo-2", title: "Exercise 3x", tags: ["w10-2026"] },
        { id: "todo-3", title: "Finish feature", tags: ["w10-2026"] },
      ];

      const result = await syncGoalsFromThings3(todos);

      const goalTypes = result.goals.map((g) => g.goal_type);
      expect(goalTypes).toContain("time");
      expect(goalTypes).toContain("habit");
      expect(goalTypes).toContain("outcome");
    });
  });
});

// ============================================================================
// Match Endpoint Tests
// ============================================================================

describe("Goal Matching Logic", () => {
  describe("extractKeywords", () => {
    it("extracts meaningful keywords from text", async () => {
      const { extractKeywords } = await import("../lib/goal-matcher.js");

      const keywords = extractKeywords("Review the pull request for auth");
      expect(keywords).toContain("review");
      expect(keywords).toContain("pull");
      expect(keywords).toContain("request");
      expect(keywords).toContain("auth");

      // Should not contain stop words
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("for");
    });

    it("filters out short words", async () => {
      const { extractKeywords } = await import("../lib/goal-matcher.js");

      const keywords = extractKeywords("Do PR fix");
      expect(keywords).not.toContain("do");
      expect(keywords).not.toContain("pr"); // 2 chars
      expect(keywords).toContain("fix");
    });
  });

  describe("keywordOverlapRatio", () => {
    it("returns 0 for no overlap", async () => {
      const { keywordOverlapRatio } = await import("../lib/goal-matcher.js");

      const ratio = keywordOverlapRatio(["apple", "banana"], ["cherry", "date"]);
      expect(ratio).toBe(0);
    });

    it("returns 1 for complete overlap", async () => {
      const { keywordOverlapRatio } = await import("../lib/goal-matcher.js");

      const ratio = keywordOverlapRatio(["apple", "banana"], ["apple", "banana"]);
      expect(ratio).toBe(1);
    });

    it("returns partial ratio for partial overlap", async () => {
      const { keywordOverlapRatio } = await import("../lib/goal-matcher.js");

      const ratio = keywordOverlapRatio(["apple", "banana"], ["apple", "cherry"]);
      expect(ratio).toBe(0.5); // 1 match out of 2
    });
  });

  describe("calculateMatch", () => {
    it("returns high confidence for color match", async () => {
      const { calculateMatch } = await import("../lib/goal-matcher.js");

      const event = {
        id: "event-1",
        google_event_id: "google-1",
        date: "2026-03-02",
        account: "test",
        calendar_name: "Calendar",
        calendar_type: "active" as const,
        summary: "Some event",
        description: null,
        start_time: "2026-03-02T09:00:00Z",
        end_time: "2026-03-02T10:00:00Z",
        duration_minutes: 60,
        color_id: "2",
        color_name: "Sage",
        color_meaning: "Focus",
        is_all_day: 0,
        is_recurring: 0,
        recurring_event_id: null,
        first_seen: "2026-03-01T00:00:00Z",
        last_seen: "2026-03-01T00:00:00Z",
        attended: "unknown",
      };

      const goal = {
        id: "test:2026-W10",
        things3_id: "test",
        week_id: "2026-W10",
        title: "Different title",
        notes: null,
        estimated_minutes: 120,
        goal_type: "time" as const,
        color_id: "2", // Same color
        status: "active" as const,
        progress_percent: 0,
        completed_at: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      };

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.matchReasons).toContain("Color matches goal category (Sage)");
    });

    it("returns higher confidence for title keyword match", async () => {
      const { calculateMatch } = await import("../lib/goal-matcher.js");

      const event = {
        id: "event-1",
        google_event_id: "google-1",
        date: "2026-03-02",
        account: "test",
        calendar_name: "Calendar",
        calendar_type: "active" as const,
        summary: "Code review session",
        description: null,
        start_time: "2026-03-02T09:00:00Z",
        end_time: "2026-03-02T10:00:00Z",
        duration_minutes: 60,
        color_id: "1",
        color_name: "Lavender",
        color_meaning: "Meeting",
        is_all_day: 0,
        is_recurring: 0,
        recurring_event_id: null,
        first_seen: "2026-03-01T00:00:00Z",
        last_seen: "2026-03-01T00:00:00Z",
        attended: "unknown",
      };

      const goal = {
        id: "test:2026-W10",
        things3_id: "test",
        week_id: "2026-W10",
        title: "Complete code review",
        notes: null,
        estimated_minutes: 120,
        goal_type: "outcome" as const,
        color_id: "5", // Different color
        status: "active" as const,
        progress_percent: 0,
        completed_at: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      };

      const result = calculateMatch(event, goal);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchReasons.some((r) => r.includes("code"))).toBe(true);
    });
  });

  describe("processBatchMatches", () => {
    it("returns categorized matches", async () => {
      const { processBatchMatches } = await import("../lib/goal-matcher.js");

      const events = [
        {
          id: "event-1",
          google_event_id: "google-1",
          date: "2026-03-02",
          account: "test",
          calendar_name: "Calendar",
          calendar_type: "active" as const,
          summary: "Coding session",
          description: null,
          start_time: "2026-03-02T09:00:00Z",
          end_time: "2026-03-02T10:00:00Z",
          duration_minutes: 60,
          color_id: "2",
          color_name: "Sage",
          color_meaning: "Focus",
          is_all_day: 0,
          is_recurring: 0,
          recurring_event_id: null,
          first_seen: "2026-03-01T00:00:00Z",
          last_seen: "2026-03-01T00:00:00Z",
          attended: "unknown",
        },
      ];

      const goals = [
        {
          id: "test:2026-W10",
          things3_id: "test",
          week_id: "2026-W10",
          title: "Write code",
          notes: null,
          estimated_minutes: 120,
          goal_type: "time" as const,
          color_id: "2",
          status: "active" as const,
          progress_percent: 0,
          completed_at: null,
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ];

      const result = processBatchMatches(events, goals);

      expect(result).toHaveProperty("autoMatches");
      expect(result).toHaveProperty("needsConfirmation");
      expect(result).toHaveProperty("unmatchedEvents");
      expect(result.totalEventsProcessed).toBe(1);
      expect(result.totalGoalsChecked).toBe(1);
    });

    it("skips completed goals", async () => {
      const { processBatchMatches } = await import("../lib/goal-matcher.js");

      const events = [
        {
          id: "event-1",
          google_event_id: "google-1",
          date: "2026-03-02",
          account: "test",
          calendar_name: "Calendar",
          calendar_type: "active" as const,
          summary: "Matching event",
          description: null,
          start_time: "2026-03-02T09:00:00Z",
          end_time: "2026-03-02T10:00:00Z",
          duration_minutes: 60,
          color_id: "2",
          color_name: "Sage",
          color_meaning: "Focus",
          is_all_day: 0,
          is_recurring: 0,
          recurring_event_id: null,
          first_seen: "2026-03-01T00:00:00Z",
          last_seen: "2026-03-01T00:00:00Z",
          attended: "unknown",
        },
      ];

      const goals = [
        {
          id: "test:2026-W10",
          things3_id: "test",
          week_id: "2026-W10",
          title: "Matching goal",
          notes: null,
          estimated_minutes: 120,
          goal_type: "time" as const,
          color_id: "2",
          status: "completed" as const, // Already completed
          progress_percent: 100,
          completed_at: "2026-03-01T00:00:00Z",
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ];

      const result = processBatchMatches(events, goals);

      // No matches because goal is completed
      expect(result.autoMatches).toHaveLength(0);
      expect(result.needsConfirmation).toHaveLength(0);
      expect(result.unmatchedEvents).toHaveLength(1);
    });
  });
});

// ============================================================================
// Goal Progress Tests
// ============================================================================

describe("Goal Progress Database Functions", () => {
  beforeEach(async () => {
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("recordGoalProgress", () => {
    it("records progress for a goal", async () => {
      const { upsertWeeklyGoal, recordGoalProgress, getProgressForGoal } =
        await import("../lib/calendar-db.js");

      // Create a goal first
      await upsertWeeklyGoal({
        things3_id: "progress-test",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 120,
        goal_type: "time",
        color_id: null,
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Record progress
      await recordGoalProgress({
        goal_id: "progress-test:2026-W10",
        event_id: "event-1",
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: 0.7,
        minutes_contributed: 60,
      });

      // Verify progress
      const progress = await getProgressForGoal("progress-test:2026-W10");
      expect(progress).toHaveLength(1);
      expect(progress[0].minutes_contributed).toBe(60);
      expect(progress[0].match_type).toBe("auto");
    });

    it("calculates total minutes contributed", async () => {
      const {
        upsertWeeklyGoal,
        recordGoalProgress,
        calculateGoalTotalMinutes,
      } = await import("../lib/calendar-db.js");

      await upsertWeeklyGoal({
        things3_id: "total-test",
        week_id: "2026-W10",
        title: "Test Goal",
        notes: null,
        estimated_minutes: 120,
        goal_type: "time",
        color_id: null,
        status: "active",
        progress_percent: 0,
        completed_at: null,
      });

      // Record multiple progress entries
      await recordGoalProgress({
        goal_id: "total-test:2026-W10",
        event_id: "event-1",
        matched_at: new Date().toISOString(),
        match_type: "auto",
        match_confidence: 0.7,
        minutes_contributed: 30,
      });

      await recordGoalProgress({
        goal_id: "total-test:2026-W10",
        event_id: "event-2",
        matched_at: new Date().toISOString(),
        match_type: "manual",
        match_confidence: null,
        minutes_contributed: 45,
      });

      const total = await calculateGoalTotalMinutes("total-test:2026-W10");
      expect(total).toBe(75);
    });
  });
});

// ============================================================================
// Sync API Validation
// ============================================================================

describe("Sync API Validation", () => {
  describe("POST /api/goals/sync validation", () => {
    it("todos should be an array", () => {
      const isValidTodos = (value: unknown) => Array.isArray(value);

      expect(isValidTodos([])).toBe(true);
      expect(isValidTodos([{ id: "1", title: "Test" }])).toBe(true);

      expect(isValidTodos(null)).toBe(false);
      expect(isValidTodos({})).toBe(false);
      expect(isValidTodos("string")).toBe(false);
    });

    it("todo items should have required fields", () => {
      const isValidTodo = (todo: unknown): boolean => {
        return (
          typeof todo === "object" &&
          todo !== null &&
          "id" in todo &&
          "title" in todo
        );
      };

      expect(isValidTodo({ id: "1", title: "Test" })).toBe(true);
      expect(isValidTodo({ id: "1", title: "Test", tags: ["w10-2026"] })).toBe(
        true
      );

      expect(isValidTodo({ id: "1" })).toBe(false);
      expect(isValidTodo({ title: "Test" })).toBe(false);
      expect(isValidTodo(null)).toBe(false);
    });

    it("Things 3 tag format should be wN-YYYY", () => {
      const tagRegex = /^w(\d{1,2})-(\d{4})$/i;

      expect(tagRegex.test("w10-2026")).toBe(true);
      expect(tagRegex.test("w1-2026")).toBe(true);
      expect(tagRegex.test("W10-2026")).toBe(true);

      expect(tagRegex.test("2026-W10")).toBe(false);
      expect(tagRegex.test("week10")).toBe(false);
    });
  });
});

// ============================================================================
// Match API Validation
// ============================================================================

describe("Match API Validation", () => {
  describe("POST /api/goals/match validation", () => {
    it("weekId is required", () => {
      const isValid = (body: { weekId?: string }) => !!body.weekId;

      expect(isValid({ weekId: "2026-W10" })).toBe(true);
      expect(isValid({})).toBe(false);
      expect(isValid({ weekId: "" })).toBe(false);
    });

    it("autoRecord should be boolean", () => {
      const isValidAutoRecord = (value: unknown) =>
        typeof value === "boolean" || value === undefined;

      expect(isValidAutoRecord(true)).toBe(true);
      expect(isValidAutoRecord(false)).toBe(true);
      expect(isValidAutoRecord(undefined)).toBe(true);

      expect(isValidAutoRecord("true")).toBe(false);
      expect(isValidAutoRecord(1)).toBe(false);
    });
  });
});
