/**
 * Non-Goals Config Tests
 *
 * Unit tests for default non-goals configuration and loader functions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, closeDatabase } from "../lib/calendar-db.js";
import * as fs from "fs";
import * as path from "path";

// Mock config path for tests
const TEST_CONFIG_DIR = path.join(process.cwd(), "config");
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, "non-goals.json");

describe("Non-Goals Configuration", () => {
  describe("loadNonGoalsConfig", () => {
    it("loads config file when it exists", async () => {
      const { loadNonGoalsConfig } = await import("../lib/weekly-goals.js");

      const config = loadNonGoalsConfig();

      // Config file should exist in the repo
      expect(config).not.toBeNull();
      expect(config?.defaults).toBeDefined();
      expect(Array.isArray(config?.defaults)).toBe(true);
    });

    it("config has expected structure", async () => {
      const { loadNonGoalsConfig } = await import("../lib/weekly-goals.js");

      const config = loadNonGoalsConfig();

      expect(config).toHaveProperty("defaults");
      expect(config).toHaveProperty("quickAdd");

      // Check defaults structure
      if (config?.defaults && config.defaults.length > 0) {
        const firstDefault = config.defaults[0];
        expect(firstDefault).toHaveProperty("title");
        expect(firstDefault).toHaveProperty("pattern");
        expect(typeof firstDefault.title).toBe("string");
        expect(typeof firstDefault.pattern).toBe("string");
      }

      // Check quickAdd structure
      if (config?.quickAdd && config.quickAdd.length > 0) {
        const firstQuickAdd = config.quickAdd[0];
        expect(firstQuickAdd).toHaveProperty("label");
        expect(firstQuickAdd).toHaveProperty("title");
        expect(firstQuickAdd).toHaveProperty("pattern");
        expect(firstQuickAdd).toHaveProperty("reason");
      }
    });
  });

  describe("getDefaultNonGoals", () => {
    it("returns array of default non-goals", async () => {
      const { getDefaultNonGoals } = await import("../lib/weekly-goals.js");

      const defaults = getDefaultNonGoals();

      expect(Array.isArray(defaults)).toBe(true);
      expect(defaults.length).toBeGreaterThan(0);
    });

    it("includes expected default patterns", async () => {
      const { getDefaultNonGoals } = await import("../lib/weekly-goals.js");

      const defaults = getDefaultNonGoals();
      const titles = defaults.map((d) => d.title);

      // Check for some expected defaults
      expect(titles).toContain("Excessive Meetings");
      expect(titles).toContain("After-Hours Work");
    });
  });

  describe("getQuickAddNonGoals", () => {
    it("returns array of quick-add templates", async () => {
      const { getQuickAddNonGoals } = await import("../lib/weekly-goals.js");

      const quickAdds = getQuickAddNonGoals();

      expect(Array.isArray(quickAdds)).toBe(true);
      expect(quickAdds.length).toBeGreaterThan(0);
    });

    it("templates have required fields", async () => {
      const { getQuickAddNonGoals } = await import("../lib/weekly-goals.js");

      const quickAdds = getQuickAddNonGoals();

      for (const template of quickAdds) {
        expect(template.label).toBeDefined();
        expect(template.title).toBeDefined();
        expect(template.pattern).toBeDefined();
        expect(template.reason).toBeDefined();
      }
    });
  });
});

describe("Non-Goals Seeding", () => {
  beforeEach(async () => {
    closeDatabase();
    await initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("seedDefaultNonGoalsForWeek", () => {
    it("creates non-goals from defaults for new week", async () => {
      const { seedDefaultNonGoalsForWeek, getDefaultNonGoals } = await import(
        "../lib/weekly-goals.js"
      );
      const { getNonGoalsForWeek } = await import("../lib/calendar-db.js");

      // Get count of simple defaults (without constraints)
      const defaults = getDefaultNonGoals();
      const simpleDefaults = defaults.filter(
        (d) => !d.timeConstraint && !d.durationConstraint && !d.recurringWithNoEnd
      );

      const created = await seedDefaultNonGoalsForWeek("2026-W10");

      // Should create one non-goal per simple default
      expect(created.length).toBe(simpleDefaults.length);

      // Verify they're in the database
      const allNonGoals = await getNonGoalsForWeek("2026-W10");
      expect(allNonGoals.length).toBe(simpleDefaults.length);
    });

    it("does not duplicate existing non-goals", async () => {
      const { seedDefaultNonGoalsForWeek } = await import(
        "../lib/weekly-goals.js"
      );
      const { getNonGoalsForWeek } = await import("../lib/calendar-db.js");

      // Seed first time
      const firstCreated = await seedDefaultNonGoalsForWeek("2026-W10");
      const countAfterFirst = (await getNonGoalsForWeek("2026-W10")).length;

      // Seed again
      const secondCreated = await seedDefaultNonGoalsForWeek("2026-W10");
      const countAfterSecond = (await getNonGoalsForWeek("2026-W10")).length;

      // Second seed should create nothing
      expect(secondCreated.length).toBe(0);
      expect(countAfterSecond).toBe(countAfterFirst);
    });

    it("seeds different weeks independently", async () => {
      const { seedDefaultNonGoalsForWeek } = await import(
        "../lib/weekly-goals.js"
      );
      const { getNonGoalsForWeek } = await import("../lib/calendar-db.js");

      await seedDefaultNonGoalsForWeek("2026-W10");
      await seedDefaultNonGoalsForWeek("2026-W11");

      const week10 = await getNonGoalsForWeek("2026-W10");
      const week11 = await getNonGoalsForWeek("2026-W11");

      // Both weeks should have their own non-goals
      expect(week10.length).toBeGreaterThan(0);
      expect(week11.length).toBeGreaterThan(0);

      // IDs should be different
      const week10Ids = new Set(week10.map((ng) => ng.id));
      const week11Ids = new Set(week11.map((ng) => ng.id));
      const overlap = [...week10Ids].filter((id) => week11Ids.has(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe("createNonGoalFromQuickAdd", () => {
    it("creates non-goal from valid template", async () => {
      const { createNonGoalFromQuickAdd, getQuickAddNonGoals } = await import(
        "../lib/weekly-goals.js"
      );

      const templates = getQuickAddNonGoals();
      if (templates.length === 0) {
        // Skip if no templates configured
        return;
      }

      const firstTemplate = templates[0];
      const nonGoal = await createNonGoalFromQuickAdd("2026-W10", firstTemplate.label);

      expect(nonGoal).not.toBeNull();
      expect(nonGoal?.title).toBe(firstTemplate.title);
      expect(nonGoal?.pattern).toBe(firstTemplate.pattern);
      expect(nonGoal?.reason).toBe(firstTemplate.reason);
    });

    it("returns null for unknown template", async () => {
      const { createNonGoalFromQuickAdd } = await import(
        "../lib/weekly-goals.js"
      );

      const nonGoal = await createNonGoalFromQuickAdd(
        "2026-W10",
        "NonExistentTemplate"
      );

      expect(nonGoal).toBeNull();
    });
  });
});

describe("Non-Goals Config File Validation", () => {
  it("config file exists", () => {
    expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true);
  });

  it("config file is valid JSON", () => {
    const content = fs.readFileSync(TEST_CONFIG_PATH, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("all default patterns are valid regex", async () => {
    const { getDefaultNonGoals } = await import("../lib/weekly-goals.js");

    const defaults = getDefaultNonGoals();

    for (const def of defaults) {
      expect(() => new RegExp(def.pattern)).not.toThrow();
    }
  });

  it("all quickAdd patterns are valid regex", async () => {
    const { getQuickAddNonGoals } = await import("../lib/weekly-goals.js");

    const quickAdds = getQuickAddNonGoals();

    for (const qa of quickAdds) {
      expect(() => new RegExp(qa.pattern)).not.toThrow();
    }
  });
});
