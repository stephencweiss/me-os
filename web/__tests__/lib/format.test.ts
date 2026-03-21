import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTime, formatDuration, formatDate, formatDisplayDate } from "@/lib/format";

describe("formatTime", () => {
  describe("with ISO timestamps", () => {
    it("formats ISO timestamp to local time", () => {
      // Use a fixed timezone for testing by mocking toLocaleTimeString
      const mockDate = new Date("2026-03-04T14:00:00.000Z");
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("9:00 AM");

      const result = formatTime("2026-03-04T14:00:00.000Z");

      expect(result).toBe("9:00 AM");
      expect(spy).toHaveBeenCalledWith("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      spy.mockRestore();
    });

    it("handles ISO timestamp with different times", () => {
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("3:30 PM");

      const result = formatTime("2026-03-04T20:30:00.000Z");

      expect(result).toBe("3:30 PM");

      spy.mockRestore();
    });

    it("correctly identifies ISO timestamps by T character", () => {
      // This test ensures we don't incorrectly parse "2026" as hours
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("7:00 AM");

      // This was the bug: "2026-02-20T13:00:00.000Z".split(":") gave ["2026-02-20T13", "00", "00.000Z"]
      // which meant hours = "2026-02-20T13" = NaN when parsed incorrectly
      const result = formatTime("2026-02-20T13:00:00.000Z");

      expect(result).toBe("7:00 AM");

      spy.mockRestore();
    });
  });

  describe("with plain time strings", () => {
    it("formats plain time string HH:MM:SS", () => {
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("9:00 AM");

      const result = formatTime("09:00:00");

      expect(result).toBe("9:00 AM");

      spy.mockRestore();
    });

    it("formats plain time string without seconds", () => {
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("2:30 PM");

      const result = formatTime("14:30");

      expect(result).toBe("2:30 PM");

      spy.mockRestore();
    });

    it("handles midnight correctly", () => {
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("12:00 AM");

      const result = formatTime("00:00:00");

      expect(result).toBe("12:00 AM");

      spy.mockRestore();
    });

    it("handles noon correctly", () => {
      const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
      spy.mockReturnValue("12:00 PM");

      const result = formatTime("12:00:00");

      expect(result).toBe("12:00 PM");

      spy.mockRestore();
    });
  });
});

describe("formatDuration", () => {
  it("formats minutes only when less than an hour", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(5)).toBe("5m");
  });

  it("formats hours only when no remaining minutes", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(180)).toBe("3h");
  });

  it("formats hours and minutes when both present", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(75)).toBe("1h 15m");
    expect(formatDuration(150)).toBe("2h 30m");
  });

  it("handles zero minutes", () => {
    expect(formatDuration(0)).toBe("0m");
  });

  it("handles large durations", () => {
    expect(formatDuration(480)).toBe("8h"); // Full work day
    expect(formatDuration(1440)).toBe("24h"); // Full day
  });
});

describe("formatDate", () => {
  it("formats date to YYYY-MM-DD in local timezone", () => {
    // Use local date constructor to avoid timezone issues
    const date = new Date(2026, 2, 4); // March 4, 2026 (month is 0-indexed)
    expect(formatDate(date)).toBe("2026-03-04");
  });

  it("handles single digit months and days with zero padding", () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(formatDate(date)).toBe("2026-01-05");
  });

  it("uses local timezone, not UTC", () => {
    // Create a date at 11pm local time - should still be the same local date
    const date = new Date(2026, 2, 4, 23, 0, 0); // March 4, 2026 at 11pm local
    expect(formatDate(date)).toBe("2026-03-04");
  });
});

describe("formatDisplayDate", () => {
  it("formats date for user display with weekday, month, day, year", () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleDateString");
    spy.mockReturnValue("Wednesday, March 4, 2026");

    const date = new Date("2026-03-04T12:00:00.000Z");
    const result = formatDisplayDate(date);

    expect(result).toBe("Wednesday, March 4, 2026");
    expect(spy).toHaveBeenCalledWith("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    spy.mockRestore();
  });
});
