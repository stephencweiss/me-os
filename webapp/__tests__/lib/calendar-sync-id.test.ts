import { describe, expect, it } from "vitest";
import { buildSupabaseEventId } from "@/lib/calendar-event-id";

describe("buildSupabaseEventId", () => {
  it("encodes segments and stays stable", () => {
    const id = buildSupabaseEventId({
      userId: "u1",
      calendarId: "cal:with:colons",
      googleEventId: "evt_1",
      startTimeUtcIso: "2026-03-19T15:00:00.000Z",
    });
    expect(id).toContain(encodeURIComponent("cal:with:colons"));
    expect(id.split(":").length).toBeGreaterThanOrEqual(4);
  });
});
