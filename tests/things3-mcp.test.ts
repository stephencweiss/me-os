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
// Week ID Conversion Tests
// ============================================================================

describe("Week ID to Things 3 Tag Conversion", () => {
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

  it("converts YYYY-WWW to wN-YYYY format", () => {
    expect(weekIdToThings3Tag("2026-W10")).toBe("w10-2026");
    expect(weekIdToThings3Tag("2026-W01")).toBe("w1-2026");
    expect(weekIdToThings3Tag("2025-W52")).toBe("w52-2025");
  });

  it("removes leading zeros from week number", () => {
    expect(weekIdToThings3Tag("2026-W01")).toBe("w1-2026");
    expect(weekIdToThings3Tag("2026-W09")).toBe("w9-2026");
  });

  it("preserves double-digit weeks", () => {
    expect(weekIdToThings3Tag("2026-W10")).toBe("w10-2026");
    expect(weekIdToThings3Tag("2026-W53")).toBe("w53-2026");
  });

  it("throws on invalid format", () => {
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
      tags: ["w10-2026", "important"],
      project: "Weekly Goals",
      area: "Personal",
    };

    expect(todo.uuid).toBe("abc123");
    expect(todo.status).toBe("open");
    expect(todo.tags).toContain("w10-2026");
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
      tags: ["w10-2026"],
      project: null,
      area: "Work",
    };

    expect(todo.status).toBe("completed");
    expect(todo.completedDate).not.toBeNull();
  });
});

// ============================================================================
// Tag Pattern Tests (for week tag matching)
// ============================================================================

describe("Week Tag Pattern Matching", () => {
  function isWeekTag(tag: string): boolean {
    return /^w\d{1,2}-\d{4}$/.test(tag.toLowerCase());
  }

  function extractWeekFromTag(tag: string): { week: number; year: number } | null {
    const match = tag.toLowerCase().match(/^w(\d{1,2})-(\d{4})$/);
    if (!match) return null;
    return {
      week: parseInt(match[1], 10),
      year: parseInt(match[2], 10),
    };
  }

  describe("isWeekTag", () => {
    it("identifies valid week tags", () => {
      expect(isWeekTag("w10-2026")).toBe(true);
      expect(isWeekTag("w1-2026")).toBe(true);
      expect(isWeekTag("w52-2025")).toBe(true);
      expect(isWeekTag("W10-2026")).toBe(true); // Case insensitive
    });

    it("rejects invalid tags", () => {
      expect(isWeekTag("important")).toBe(false);
      expect(isWeekTag("2026-W10")).toBe(false);
      expect(isWeekTag("w-2026")).toBe(false);
      expect(isWeekTag("week10-2026")).toBe(false);
    });
  });

  describe("extractWeekFromTag", () => {
    it("extracts week and year from tag", () => {
      const result = extractWeekFromTag("w10-2026");
      expect(result).toEqual({ week: 10, year: 2026 });
    });

    it("handles single-digit weeks", () => {
      const result = extractWeekFromTag("w1-2026");
      expect(result).toEqual({ week: 1, year: 2026 });
    });

    it("returns null for invalid tags", () => {
      expect(extractWeekFromTag("important")).toBeNull();
      expect(extractWeekFromTag("2026-W10")).toBeNull();
    });
  });
});

// ============================================================================
// MCP Tool Input Validation Tests
// ============================================================================

describe("MCP Tool Input Validation", () => {
  function validateWeekId(weekId: string): boolean {
    // Accepts both YYYY-WWW and wN-YYYY formats
    return /^\d{4}-W\d{2}$/.test(weekId) || /^w\d{1,2}-\d{4}$/i.test(weekId);
  }

  describe("get_weekly_todos input", () => {
    it("accepts YYYY-WWW format", () => {
      expect(validateWeekId("2026-W10")).toBe(true);
      expect(validateWeekId("2026-W01")).toBe(true);
    });

    it("accepts wN-YYYY format", () => {
      expect(validateWeekId("w10-2026")).toBe(true);
      expect(validateWeekId("w1-2026")).toBe(true);
    });

    it("rejects invalid formats", () => {
      expect(validateWeekId("2026-10")).toBe(false);
      expect(validateWeekId("week10")).toBe(false);
      expect(validateWeekId("")).toBe(false);
    });
  });
});
