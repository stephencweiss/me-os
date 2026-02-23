import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Import functions to test (will be implemented)
import {
  parseGoalsFromText,
  loadRecurringGoals,
  saveRecurringGoal,
  removeRecurringGoal,
  findSlotsForGoal,
  type TimeGoal,
  type OutcomeGoal,
  type FlexSlot,
  type ProposedEvent,
} from "../lib/calendar-optimizer.js";

// ============================================
// Goal Parsing Tests
// ============================================

describe("parseGoalsFromText", () => {
  it('parses "4 hours of writing time" into TimeGoal', () => {
    const goals = parseGoalsFromText("4 hours of writing time");
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.type).toBe("time");
    expect(goal.name.toLowerCase()).toContain("writing");
    expect(goal.totalMinutes).toBe(240); // 4 hours
  });

  it('parses "2h focus time" with shorthand notation', () => {
    const goals = parseGoalsFromText("2h focus time");
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.totalMinutes).toBe(120); // 2 hours
  });

  it('parses "workout 3x this week" with session count', () => {
    const goals = parseGoalsFromText("workout 3x this week, 45 min each");
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.type).toBe("time");
    expect(goal.sessionsPerWeek).toBe(3);
    expect(goal.minSessionMinutes).toBe(45);
    expect(goal.maxSessionMinutes).toBe(45);
    expect(goal.totalMinutes).toBe(135); // 3 × 45
  });

  it("parses min/max session constraints", () => {
    const goals = parseGoalsFromText(
      "4 hours of deep work, 1-2 hour sessions"
    );
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.totalMinutes).toBe(240);
    expect(goal.minSessionMinutes).toBe(60);
    expect(goal.maxSessionMinutes).toBe(120);
  });

  it("parses multiple goals from multi-line text", () => {
    const text = `
      - 4 hours of writing time
      - workout 3x this week, 45 min each
      - 2 hours of learning
    `;
    const goals = parseGoalsFromText(text);
    expect(goals).toHaveLength(3);
  });

  it("handles outcome goals with descriptions", () => {
    const goals = parseGoalsFromText(
      "Focus on Project X to achieve milestone Y, about 6 hours"
    );
    expect(goals).toHaveLength(1);
    const goal = goals[0] as OutcomeGoal;
    expect(goal.type).toBe("outcome");
    expect(goal.name).toContain("Project X");
    expect(goal.description).toContain("milestone Y");
    expect(goal.estimatedMinutes).toBe(360); // 6 hours
  });

  it("returns empty array for empty input", () => {
    const goals = parseGoalsFromText("");
    expect(goals).toHaveLength(0);
  });

  it("returns empty array for text with no parseable goals", () => {
    const goals = parseGoalsFromText("hello world, how are you?");
    expect(goals).toHaveLength(0);
  });

  it("parses preferred time of day", () => {
    const goals = parseGoalsFromText("4 hours of writing time in the morning");
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.preferredTimes?.dayPart).toBe("morning");
  });

  it("parses afternoon preference", () => {
    const goals = parseGoalsFromText("2h deep work in the afternoon");
    expect(goals).toHaveLength(1);
    const goal = goals[0] as TimeGoal;
    expect(goal.preferredTimes?.dayPart).toBe("afternoon");
  });
});

// ============================================
// Goal Config Load/Save Tests
// ============================================

describe("loadRecurringGoals", () => {
  const testConfigPath = "/tmp/test-optimization-goals.json";

  afterEach(() => {
    // Clean up test file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it("loads goals from config file", () => {
    const config = {
      recurringGoals: [
        {
          id: "writing",
          name: "Writing time",
          totalMinutes: 240,
          minSessionMinutes: 60,
          maxSessionMinutes: 120,
          colorId: "2",
          priority: 1,
        },
      ],
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));

    const goals = loadRecurringGoals(testConfigPath);
    expect(goals).toHaveLength(1);
    expect(goals[0].name).toBe("Writing time");
    expect(goals[0].totalMinutes).toBe(240);
  });

  it("returns empty array if file missing", () => {
    const goals = loadRecurringGoals("/tmp/nonexistent-file.json");
    expect(goals).toHaveLength(0);
  });

  it("returns empty array if file is invalid JSON", () => {
    fs.writeFileSync(testConfigPath, "not valid json {{{");
    const goals = loadRecurringGoals(testConfigPath);
    expect(goals).toHaveLength(0);
  });

  it("returns empty array if recurringGoals key missing", () => {
    fs.writeFileSync(testConfigPath, JSON.stringify({ other: "data" }));
    const goals = loadRecurringGoals(testConfigPath);
    expect(goals).toHaveLength(0);
  });
});

describe("saveRecurringGoal", () => {
  const testConfigPath = "/tmp/test-optimization-goals.json";

  beforeEach(() => {
    // Start with empty config
    fs.writeFileSync(
      testConfigPath,
      JSON.stringify({ recurringGoals: [] }, null, 2)
    );
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it("adds new goal to config", () => {
    const newGoal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 240,
      minSessionMinutes: 60,
      maxSessionMinutes: 120,
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    saveRecurringGoal(newGoal, testConfigPath);

    const saved = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    expect(saved.recurringGoals).toHaveLength(1);
    expect(saved.recurringGoals[0].name).toBe("Writing time");
  });

  it("updates existing goal by id", () => {
    // First save
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 240,
      minSessionMinutes: 60,
      maxSessionMinutes: 120,
      colorId: "2",
      priority: 1,
      recurring: true,
    };
    saveRecurringGoal(goal, testConfigPath);

    // Update same goal
    const updatedGoal: TimeGoal = {
      ...goal,
      totalMinutes: 300,
      name: "Writing time (updated)",
    };
    saveRecurringGoal(updatedGoal, testConfigPath);

    const saved = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    expect(saved.recurringGoals).toHaveLength(1); // Still 1, not 2
    expect(saved.recurringGoals[0].totalMinutes).toBe(300);
    expect(saved.recurringGoals[0].name).toBe("Writing time (updated)");
  });

  it("creates config file if it does not exist", () => {
    const newPath = "/tmp/new-config-file.json";
    if (fs.existsSync(newPath)) fs.unlinkSync(newPath);

    const goal: TimeGoal = {
      type: "time",
      id: "test",
      name: "Test goal",
      totalMinutes: 60,
      colorId: "1",
      priority: 1,
      recurring: true,
    };
    saveRecurringGoal(goal, newPath);

    expect(fs.existsSync(newPath)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(newPath, "utf-8"));
    expect(saved.recurringGoals).toHaveLength(1);

    fs.unlinkSync(newPath);
  });
});

describe("removeRecurringGoal", () => {
  const testConfigPath = "/tmp/test-optimization-goals.json";

  beforeEach(() => {
    const config = {
      recurringGoals: [
        { id: "goal1", name: "Goal 1", totalMinutes: 60 },
        { id: "goal2", name: "Goal 2", totalMinutes: 120 },
        { id: "goal3", name: "Goal 3", totalMinutes: 180 },
      ],
    };
    fs.writeFileSync(testConfigPath, JSON.stringify(config, null, 2));
  });

  afterEach(() => {
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it("removes goal by id", () => {
    removeRecurringGoal("goal2", testConfigPath);

    const saved = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    expect(saved.recurringGoals).toHaveLength(2);
    expect(saved.recurringGoals.find((g: any) => g.id === "goal2")).toBeUndefined();
  });

  it("does nothing if goal id not found", () => {
    removeRecurringGoal("nonexistent", testConfigPath);

    const saved = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    expect(saved.recurringGoals).toHaveLength(3);
  });
});

// ============================================
// Slot Allocation Tests
// ============================================

describe("findSlotsForGoal", () => {
  // Helper to create a date at a specific time today
  function todayAt(hour: number, minute: number = 0): Date {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  // Helper to create a FlexSlot
  function createSlot(startHour: number, endHour: number, startMinute = 0, endMinute = 0): FlexSlot {
    return {
      start: todayAt(startHour, startMinute),
      end: todayAt(endHour, endMinute),
      durationMinutes: (endHour - startHour) * 60 + (endMinute - startMinute),
    };
  }

  it("allocates a single session when goal fits in one gap", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 120, // 2 hours
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 12), // 3-hour gap
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    expect(proposed).toHaveLength(1);
    expect(proposed[0].durationMinutes).toBe(120);
  });

  it("allocates multiple sessions when goal requires splitting", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 240, // 4 hours
      minSessionMinutes: 60,
      maxSessionMinutes: 120,
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 11), // 2-hour gap
      createSlot(14, 16), // 2-hour gap
      createSlot(17, 18), // 1-hour gap
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    // Should allocate 2h + 2h = 4h across two gaps
    expect(proposed.length).toBeGreaterThanOrEqual(2);
    const totalAllocated = proposed.reduce((sum, p) => sum + p.durationMinutes, 0);
    expect(totalAllocated).toBe(240);
  });

  it("respects minSessionMinutes constraint", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "deep-work",
      name: "Deep work",
      totalMinutes: 180, // 3 hours
      minSessionMinutes: 90, // At least 1.5 hours per session
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 10), // 1-hour gap (too small)
      createSlot(11, 13), // 2-hour gap (fits)
      createSlot(14, 15, 0, 30), // 1.5-hour gap (fits exactly)
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    // Should skip the 1-hour gap, use the 2-hour and 1.5-hour gaps
    expect(proposed).toHaveLength(2);
    // Each proposed session should be at least 90 minutes
    for (const p of proposed) {
      expect(p.durationMinutes).toBeGreaterThanOrEqual(90);
    }
  });

  it("respects maxSessionMinutes constraint", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "focus",
      name: "Focus time",
      totalMinutes: 180, // 3 hours
      maxSessionMinutes: 60, // Max 1 hour per session
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 12), // 3-hour gap
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    // Should split into 3 sessions of 1 hour each
    expect(proposed).toHaveLength(3);
    for (const p of proposed) {
      expect(p.durationMinutes).toBe(60);
    }
  });

  it("prefers morning slots when preferredTimes.dayPart is morning", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 120,
      preferredTimes: { dayPart: "morning" },
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(14, 17), // afternoon gap (3h)
      createSlot(7, 9), // morning gap (2h)
      createSlot(18, 20), // evening gap (2h)
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    expect(proposed).toHaveLength(1);
    // Should pick the morning slot
    expect(proposed[0].start.getHours()).toBeLessThan(12);
  });

  it("prefers afternoon slots when preferredTimes.dayPart is afternoon", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "meetings",
      name: "Meeting prep",
      totalMinutes: 60,
      preferredTimes: { dayPart: "afternoon" },
      colorId: "3",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(7, 9), // morning
      createSlot(14, 17), // afternoon
      createSlot(18, 20), // evening
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    expect(proposed).toHaveLength(1);
    // Should pick afternoon slot (14:00)
    const hour = proposed[0].start.getHours();
    expect(hour).toBeGreaterThanOrEqual(12);
    expect(hour).toBeLessThan(18);
  });

  it("returns partial allocation when gaps are insufficient", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 300, // 5 hours needed
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 10), // 1 hour
      createSlot(14, 15), // 1 hour
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    // Only 2 hours available
    const totalAllocated = proposed.reduce((sum, p) => sum + p.durationMinutes, 0);
    expect(totalAllocated).toBe(120); // 2 hours
    expect(totalAllocated).toBeLessThan(300); // Less than needed
  });

  it("returns empty array when no suitable gaps", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "deep-work",
      name: "Deep work",
      totalMinutes: 120,
      minSessionMinutes: 120, // Need at least 2 hours per session
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [
      createSlot(9, 10), // 1 hour (too small)
      createSlot(14, 15), // 1 hour (too small)
    ];

    const proposed = findSlotsForGoal(goal, gaps);
    expect(proposed).toHaveLength(0);
  });

  it("sets correct properties on proposed events", () => {
    const goal: TimeGoal = {
      type: "time",
      id: "writing",
      name: "Writing time",
      totalMinutes: 60,
      colorId: "2",
      priority: 1,
      recurring: true,
    };

    const gaps: FlexSlot[] = [createSlot(9, 10)];

    const proposed = findSlotsForGoal(goal, gaps);
    expect(proposed).toHaveLength(1);
    expect(proposed[0].summary).toBe("Writing time");
    expect(proposed[0].colorId).toBe("2");
    expect(proposed[0].goalId).toBe("writing");
    expect(proposed[0].durationMinutes).toBe(60);
  });
});
