import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Import functions to test (will be implemented)
import {
  parseGoalsFromText,
  loadRecurringGoals,
  saveRecurringGoal,
  removeRecurringGoal,
  type TimeGoal,
  type OutcomeGoal,
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
