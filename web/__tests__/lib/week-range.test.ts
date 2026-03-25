import { describe, expect, it } from "vitest";
import {
  parseWeekRangeDays,
  weekRangeSearchParamNeedsRedirect,
} from "@/lib/week-range";

describe("parseWeekRangeDays", () => {
  it("defaults missing or empty to 7", () => {
    expect(parseWeekRangeDays(undefined)).toBe(7);
    expect(parseWeekRangeDays("")).toBe(7);
  });

  it("accepts allowed values", () => {
    expect(parseWeekRangeDays("7")).toBe(7);
    expect(parseWeekRangeDays("14")).toBe(14);
    expect(parseWeekRangeDays("30")).toBe(30);
    expect(parseWeekRangeDays("90")).toBe(90);
  });

  it("rejects invalid and falls back to 7", () => {
    expect(parseWeekRangeDays("abc")).toBe(7);
    expect(parseWeekRangeDays("99")).toBe(7);
    expect(parseWeekRangeDays("7.5")).toBe(7);
  });
});

describe("weekRangeSearchParamNeedsRedirect", () => {
  it("redirects when param missing", () => {
    expect(weekRangeSearchParamNeedsRedirect(undefined, 7)).toBe(true);
  });

  it("redirects when non-canonical", () => {
    expect(weekRangeSearchParamNeedsRedirect("07", 7)).toBe(true);
  });

  it("no redirect when canonical", () => {
    expect(weekRangeSearchParamNeedsRedirect("7", 7)).toBe(false);
    expect(weekRangeSearchParamNeedsRedirect("14", 14)).toBe(false);
  });
});
