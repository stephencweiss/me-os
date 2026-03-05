/**
 * Things 3 MCP Server Tests
 *
 * Tests for the Things 3 MCP server utilities and functions.
 * Note: Full integration tests require Things 3 to be installed,
 * so these focus on utility functions and mock database scenarios.
 */

import { describe, it, expect } from "vitest";

// ============================================================================
// Date Conversion Tests
// ============================================================================

describe("Things 3 Date Conversions", () => {
  /**
   * Things 3 stores dates as Julian Day numbers with fractional time.
   * Julian day epoch is November 24, 4714 BC.
   * Unix epoch (Jan 1, 1970) is Julian day 2440587.5
   */
  function julianToISODate(julian: number | null): string | null {
    if (julian === null || julian === 0) return null;
    const unixEpochJulian = 2440587.5;
    const unixTimestamp = (julian - unixEpochJulian) * 86400 * 1000;
    return new Date(unixTimestamp).toISOString();
  }

  /**
   * Things 3 also uses Core Data-style timestamps (seconds since Jan 1, 2001)
   */
  function coreDataToISODate(timestamp: number | null): string | null {
    if (timestamp === null || timestamp === 0) return null;
    const coreDataEpochOffset = 978307200;
    const unixTimestamp = (timestamp + coreDataEpochOffset) * 1000;
    return new Date(unixTimestamp).toISOString();
  }

  describe("julianToISODate", () => {
    it("converts Julian day to ISO date", () => {
      // Unix epoch (Jan 1, 1970) is Julian day 2440587.5
      // Let's verify using a known date
      const unixEpochJulian = 2440587.5;
      const result = julianToISODate(unixEpochJulian);

      expect(result).not.toBeNull();
      expect(result).toMatch(/1970-01-01/);
    });

    it("returns null for null input", () => {
      expect(julianToISODate(null)).toBeNull();
    });

    it("returns null for zero input", () => {
      expect(julianToISODate(0)).toBeNull();
    });

    it("handles Jan 1, 2000 correctly", () => {
      // Jan 1, 2000 is Julian day 2451544.5
      const julian = 2451544.5;
      const result = julianToISODate(julian);

      expect(result).not.toBeNull();
      expect(result).toMatch(/2000-01-01/);
    });
  });

  describe("coreDataToISODate", () => {
    it("converts Core Data timestamp to ISO date", () => {
      // Core Data epoch is Jan 1, 2001
      // 1 second after epoch = Jan 1, 2001 00:00:01
      const timestamp = 1;
      const result = coreDataToISODate(timestamp);

      expect(result).not.toBeNull();
      expect(result).toMatch(/2001-01-01/);
    });

    it("returns null for null input", () => {
      expect(coreDataToISODate(null)).toBeNull();
    });

    it("converts future dates correctly", () => {
      // March 4, 2026 is approximately 794,188,800 seconds after Core Data epoch
      // Let's calculate: from Jan 1, 2001 to March 4, 2026
      // 25 years + 63 days = ~9193 days = 794,211,200 seconds (approx)
      const timestamp = 794188800;
      const result = coreDataToISODate(timestamp);

      expect(result).not.toBeNull();
      // The result should be somewhere in early 2026
      expect(result).toMatch(/202[56]/);
    });
  });
});

// ============================================================================
// Status Conversion Tests
// ============================================================================

describe("Things 3 Status Conversions", () => {
  function statusFromInt(status: number): "open" | "completed" | "cancelled" {
    switch (status) {
      case 3:
        return "completed";
      case 2:
        return "cancelled";
      default:
        return "open";
    }
  }

  it("converts 0 to open", () => {
    expect(statusFromInt(0)).toBe("open");
  });

  it("converts 1 to open (default)", () => {
    expect(statusFromInt(1)).toBe("open");
  });

  it("converts 2 to cancelled", () => {
    expect(statusFromInt(2)).toBe("cancelled");
  });

  it("converts 3 to completed", () => {
    expect(statusFromInt(3)).toBe("completed");
  });

  it("handles unknown values as open", () => {
    expect(statusFromInt(99)).toBe("open");
    expect(statusFromInt(-1)).toBe("open");
  });
});

// ============================================================================
// Week ID Conversion Tests (Deprecated)
// ============================================================================

describe("Week ID to Things 3 Tag Conversion (Deprecated)", () => {
  /**
   * @deprecated No longer used - weekly goals now use simple "week" tag
   * with week inferred from deadline. Kept for backward compatibility testing.
   */
  function weekIdToThings3Tag(weekId: string): string {
    const match = weekId.match(/^(\d{4})-W(\d{2})$/);
    if (!match) {
      throw new Error(
        `Invalid week ID format: ${weekId}. Expected YYYY-WWW (e.g., 2026-W10)`
      );
    }
    const [, year, week] = match;
    return `w${parseInt(week, 10)}-${year}`;
  }

  it("(legacy) converts YYYY-WWW to wN-YYYY format", () => {
    expect(weekIdToThings3Tag("2026-W10")).toBe("w10-2026");
    expect(weekIdToThings3Tag("2026-W01")).toBe("w1-2026");
    expect(weekIdToThings3Tag("2025-W52")).toBe("w52-2025");
  });

  it("(legacy) removes leading zeros from week number", () => {
    expect(weekIdToThings3Tag("2026-W01")).toBe("w1-2026");
    expect(weekIdToThings3Tag("2026-W09")).toBe("w9-2026");
  });

  it("(legacy) preserves double-digit weeks", () => {
    expect(weekIdToThings3Tag("2026-W10")).toBe("w10-2026");
    expect(weekIdToThings3Tag("2026-W53")).toBe("w53-2026");
  });

  it("(legacy) throws on invalid format", () => {
    expect(() => weekIdToThings3Tag("2026-10")).toThrow();
    expect(() => weekIdToThings3Tag("W10-2026")).toThrow();
    expect(() => weekIdToThings3Tag("invalid")).toThrow();
    expect(() => weekIdToThings3Tag("")).toThrow();
  });
});

// ============================================================================
// Things 3 Todo Type Tests
// ============================================================================

describe("Things 3 Todo Types", () => {
  interface Things3Todo {
    uuid: string;
    title: string;
    notes: string | null;
    status: "open" | "completed" | "cancelled";
    startDate: string | null;
    dueDate: string | null;
    completedDate: string | null;
    createdDate: string;
    modifiedDate: string;
    tags: string[];
    project: string | null;
    area: string | null;
  }

  it("validates todo structure", () => {
    const todo: Things3Todo = {
      uuid: "abc123",
      title: "Test Todo",
      notes: "Some notes",
      status: "open",
      startDate: "2026-03-02T00:00:00Z",
      dueDate: "2026-03-08T00:00:00Z",
      completedDate: null,
      createdDate: "2026-03-01T10:00:00Z",
      modifiedDate: "2026-03-01T10:00:00Z",
      tags: ["week", "important"],
      project: "Weekly Goals",
      area: "Personal",
    };

    expect(todo.uuid).toBe("abc123");
    expect(todo.status).toBe("open");
    expect(todo.tags).toContain("week");
    expect(todo.completedDate).toBeNull();
  });

  it("handles empty tags array", () => {
    const todo: Things3Todo = {
      uuid: "abc123",
      title: "Untagged Todo",
      notes: null,
      status: "open",
      startDate: null,
      dueDate: null,
      completedDate: null,
      createdDate: "2026-03-01T10:00:00Z",
      modifiedDate: "2026-03-01T10:00:00Z",
      tags: [],
      project: null,
      area: null,
    };

    expect(todo.tags).toHaveLength(0);
    expect(todo.project).toBeNull();
    expect(todo.area).toBeNull();
  });

  it("handles completed todo", () => {
    const todo: Things3Todo = {
      uuid: "abc123",
      title: "Completed Todo",
      notes: null,
      status: "completed",
      startDate: "2026-03-02T00:00:00Z",
      dueDate: "2026-03-08T00:00:00Z",
      completedDate: "2026-03-05T14:30:00Z",
      createdDate: "2026-03-01T10:00:00Z",
      modifiedDate: "2026-03-05T14:30:00Z",
      tags: ["week"],
      project: null,
      area: "Work",
    };

    expect(todo.status).toBe("completed");
    expect(todo.completedDate).not.toBeNull();
  });
});

// ============================================================================
// Week Tag Detection and Week ID Inference Tests
// ============================================================================

describe("Week Tag Detection", () => {
  /**
   * Check if a todo has the "week" tag (making it a weekly goal)
   */
  function hasWeekTag(tags: string[]): boolean {
    return tags.some((t) => t.toLowerCase() === "week");
  }

  describe("hasWeekTag", () => {
    it("identifies todos with 'week' tag", () => {
      expect(hasWeekTag(["week"])).toBe(true);
      expect(hasWeekTag(["week", "important"])).toBe(true);
      expect(hasWeekTag(["Week"])).toBe(true); // Case insensitive
      expect(hasWeekTag(["WEEK"])).toBe(true); // Case insensitive
    });

    it("rejects todos without 'week' tag", () => {
      expect(hasWeekTag([])).toBe(false);
      expect(hasWeekTag(["important"])).toBe(false);
      expect(hasWeekTag(["weekly"])).toBe(false);
      expect(hasWeekTag(["w10-2026"])).toBe(false); // Old format not detected
    });
  });
});

describe("Week ID Inference from Deadline", () => {
  /**
   * Get the ISO week ID for a given date
   */
  function getWeekIdForDate(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  }

  /**
   * Get the current week ID
   */
  function getCurrentWeekId(): string {
    return getWeekIdForDate(new Date());
  }

  /**
   * Infer week ID from a todo's deadline (or current week if no deadline)
   */
  function inferWeekIdFromDeadline(deadline: string | null): string {
    if (deadline) {
      return getWeekIdForDate(new Date(deadline));
    }
    return getCurrentWeekId();
  }

  describe("getWeekIdForDate", () => {
    it("returns correct week ID for known dates", () => {
      // Use mid-week dates to avoid edge cases with week boundaries
      // March 4, 2026 (Wednesday) is in week 10
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 2, 4)))).toBe("2026-W10");

      // March 5, 2026 (Thursday of week 10)
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 2, 5)))).toBe("2026-W10");

      // March 6, 2026 (Friday of week 10)
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 2, 6)))).toBe("2026-W10");

      // Jan 2, 2026 (Friday of week 1)
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 0, 2)))).toBe("2026-W01");
    });

    it("handles different weeks correctly", () => {
      // Week 11 (Mar 9-15)
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 2, 11)))).toBe("2026-W11");

      // Week 9 (Feb 23 - Mar 1)
      expect(getWeekIdForDate(new Date(Date.UTC(2026, 1, 25)))).toBe("2026-W09");
    });

    it("returns valid week ID format", () => {
      const weekId = getWeekIdForDate(new Date(Date.UTC(2025, 11, 31)));
      expect(weekId).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  describe("inferWeekIdFromDeadline", () => {
    it("infers week from deadline", () => {
      expect(inferWeekIdFromDeadline("2026-03-06")).toBe("2026-W10");
      expect(inferWeekIdFromDeadline("2026-03-08")).toBe("2026-W10");
    });

    it("returns current week when no deadline", () => {
      const result = inferWeekIdFromDeadline(null);
      expect(result).toBe(getCurrentWeekId());
    });

    it("handles ISO date strings", () => {
      expect(inferWeekIdFromDeadline("2026-03-04T12:00:00Z")).toBe("2026-W10");
    });
  });
});

// ============================================================================
// Legacy Week Tag Tests (Deprecated - for backward compatibility only)
// ============================================================================

describe("Legacy Week Tag Pattern (Deprecated)", () => {
  /**
   * @deprecated Use week inference from deadline instead
   */
  function isLegacyWeekTag(tag: string): boolean {
    return /^w\d{1,2}-\d{4}$/.test(tag.toLowerCase());
  }

  /**
   * @deprecated Use week inference from deadline instead
   */
  function extractWeekFromLegacyTag(tag: string): { week: number; year: number } | null {
    const match = tag.toLowerCase().match(/^w(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    return {
      week: parseInt(match[1], 10),
      year: parseInt(match[2], 10),
    };
  }

  describe("isLegacyWeekTag", () => {
    it("identifies legacy week tags", () => {
      expect(isLegacyWeekTag("w10-2026")).toBe(true);
      expect(isLegacyWeekTag("w1-2026")).toBe(true);
    });
  });

  describe("extractWeekFromLegacyTag", () => {
    it("extracts week and year from legacy tag", () => {
      const result = extractWeekFromLegacyTag("w10-2026");
      expect(result).toEqual({ week: 10, year: 2026 });
    });
  });
});

// ============================================================================
// MCP Tool Input Validation Tests
// ============================================================================

describe("MCP Tool Input Validation", () => {
  function validateWeekId(weekId: string): boolean {
    // Only accepts ISO week format: YYYY-WWW
    return /^\d{4}-W\d{2}$/.test(weekId);
  }

  describe("get_weekly_todos input", () => {
    it("accepts ISO week format (YYYY-WWW)", () => {
      expect(validateWeekId("2026-W10")).toBe(true);
      expect(validateWeekId("2026-W01")).toBe(true);
      expect(validateWeekId("2025-W52")).toBe(true);
    });

    it("rejects legacy wN-YYYY format", () => {
      expect(validateWeekId("w10-2026")).toBe(false);
      expect(validateWeekId("w1-2026")).toBe(false);
    });

    it("rejects invalid formats", () => {
      expect(validateWeekId("2026-10")).toBe(false);
      expect(validateWeekId("week10")).toBe(false);
      expect(validateWeekId("")).toBe(false);
      expect(validateWeekId("week")).toBe(false); // "week" is a tag, not a week ID
    });
  });
});
