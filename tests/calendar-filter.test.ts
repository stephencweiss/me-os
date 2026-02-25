import { describe, it, expect, beforeEach } from "vitest";
import {
  CalendarFilterConfig,
  CalendarType,
  CalendarInfo,
  getDefaultCalendarFilterConfig,
  getCalendarType,
  getCalendarTypeBehavior,
  shouldIncludeEvent,
  isUserInvolvedInEvent,
  suggestCalendarType,
} from "../lib/calendar-filter.js";

describe("calendar-filter", () => {
  describe("getDefaultCalendarFilterConfig", () => {
    it("returns default config with empty calendarTypes", () => {
      const config = getDefaultCalendarFilterConfig();
      expect(config.calendarTypes).toEqual({});
    });

    it("returns default types as active", () => {
      const config = getDefaultCalendarFilterConfig();
      expect(config.defaultType.primary).toBe("active");
      expect(config.defaultType.owner).toBe("active");
      expect(config.defaultType.shared).toBe("active");
    });

    it("returns empty filtering lists", () => {
      const config = getDefaultCalendarFilterConfig();
      expect(config.filtering.denyList).toEqual([]);
      expect(config.filtering.allowList).toEqual([]);
    });
  });

  describe("getCalendarType", () => {
    let config: CalendarFilterConfig;

    beforeEach(() => {
      config = {
        calendarTypes: {
          "On Call Schedule": "availability",
          "NEA Vacation Calendar": "reference",
          "c_abc123@group.calendar.google.com": "blocking",
        },
        defaultType: {
          primary: "active",
          owner: "active",
          shared: "active",
        },
        filtering: {
          denyList: ["Company Calendar", "Holidays in United States"],
          allowList: ["Special Project Calendar"],
        },
      };
    });

    it("returns excluded for calendars in denyList", () => {
      const calendar: CalendarInfo = {
        id: "company@calendar.google.com",
        summary: "Company Calendar",
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("excluded");
    });

    it("returns excluded for denyList match by case-insensitive name", () => {
      const calendar: CalendarInfo = {
        id: "test@calendar.google.com",
        summary: "company calendar", // lowercase
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("excluded");
    });

    it("returns explicit type from calendarTypes config", () => {
      const calendar: CalendarInfo = {
        id: "oncall@import.calendar.google.com",
        summary: "On Call Schedule",
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("availability");
    });

    it("returns explicit type by calendar ID match", () => {
      const calendar: CalendarInfo = {
        id: "c_abc123@group.calendar.google.com",
        summary: "Some Random Name",
        accessRole: "owner",
      };
      expect(getCalendarType(calendar, config)).toBe("blocking");
    });

    it("matches calendar names case-insensitively", () => {
      const calendar: CalendarInfo = {
        id: "test@calendar.google.com",
        summary: "on call schedule", // lowercase
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("availability");
    });

    it("returns active for allowList calendars", () => {
      const calendar: CalendarInfo = {
        id: "special@calendar.google.com",
        summary: "Special Project Calendar",
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("active");
    });

    it("returns defaultType.primary for primary calendars", () => {
      const calendar: CalendarInfo = {
        id: "user@gmail.com",
        summary: "user@gmail.com",
        primary: true,
        accessRole: "owner",
      };
      expect(getCalendarType(calendar, config)).toBe("active");
    });

    it("returns defaultType.owner for owned calendars", () => {
      const calendar: CalendarInfo = {
        id: "owned@calendar.google.com",
        summary: "My Custom Calendar",
        accessRole: "owner",
      };
      expect(getCalendarType(calendar, config)).toBe("active");
    });

    it("returns defaultType.shared for reader calendars", () => {
      const calendar: CalendarInfo = {
        id: "shared@calendar.google.com",
        summary: "Shared Calendar",
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("active");
    });

    it("returns defaultType.shared for writer calendars", () => {
      const calendar: CalendarInfo = {
        id: "shared@calendar.google.com",
        summary: "Shared Calendar",
        accessRole: "writer",
      };
      expect(getCalendarType(calendar, config)).toBe("active");
    });

    it("denyList takes priority over explicit calendarTypes", () => {
      // Add a calendar to both denyList and calendarTypes
      config.filtering.denyList.push("On Call Schedule");
      const calendar: CalendarInfo = {
        id: "oncall@import.calendar.google.com",
        summary: "On Call Schedule",
        accessRole: "reader",
      };
      expect(getCalendarType(calendar, config)).toBe("excluded");
    });

    it("calendarTypes takes priority over allowList", () => {
      // Add a calendar to both calendarTypes and allowList
      config.filtering.allowList.push("NEA Vacation Calendar");
      const calendar: CalendarInfo = {
        id: "vacation@calendar.google.com",
        summary: "NEA Vacation Calendar",
        accessRole: "owner",
      };
      expect(getCalendarType(calendar, config)).toBe("reference");
    });
  });

  describe("getCalendarTypeBehavior", () => {
    it("active: counts time, fills gaps, blocks scheduling", () => {
      const behavior = getCalendarTypeBehavior("active");
      expect(behavior.countsForTimeTracking).toBe(true);
      expect(behavior.fillsGaps).toBe(true);
      expect(behavior.blocksScheduling).toBe(true);
    });

    it("availability: no time, no gaps, no blocking (context only)", () => {
      const behavior = getCalendarTypeBehavior("availability");
      expect(behavior.countsForTimeTracking).toBe(false);
      expect(behavior.fillsGaps).toBe(false);
      expect(behavior.blocksScheduling).toBe(false);
    });

    it("reference: no time, no gaps, no blocking", () => {
      const behavior = getCalendarTypeBehavior("reference");
      expect(behavior.countsForTimeTracking).toBe(false);
      expect(behavior.fillsGaps).toBe(false);
      expect(behavior.blocksScheduling).toBe(false);
    });

    it("blocking: no time, fills gaps, blocks scheduling", () => {
      const behavior = getCalendarTypeBehavior("blocking");
      expect(behavior.countsForTimeTracking).toBe(false);
      expect(behavior.fillsGaps).toBe(true);
      expect(behavior.blocksScheduling).toBe(true);
    });
  });

  describe("isUserInvolvedInEvent", () => {
    const userEmail = "user@example.com";

    it("returns true when user is organizer with self=true", () => {
      const event = {
        organizer: { self: true, email: "user@example.com" },
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns true when user email matches organizer", () => {
      const event = {
        organizer: { email: "user@example.com" },
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns true when user email matches organizer (case-insensitive)", () => {
      const event = {
        organizer: { email: "USER@EXAMPLE.COM" },
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns true when user is attendee with self=true", () => {
      const event = {
        attendees: [
          { email: "other@example.com" },
          { email: "user@example.com", self: true },
        ],
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns true when user email matches attendee", () => {
      const event = {
        attendees: [
          { email: "other@example.com" },
          { email: "user@example.com" },
        ],
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns true when user email matches attendee (case-insensitive)", () => {
      const event = {
        attendees: [{ email: "USER@EXAMPLE.COM" }],
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(true);
    });

    it("returns false when user is not involved", () => {
      const event = {
        organizer: { email: "other@example.com" },
        attendees: [
          { email: "person1@example.com" },
          { email: "person2@example.com" },
        ],
      };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(false);
    });

    it("returns false for events with no attendees list", () => {
      const event = {};
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(false);
    });

    it("returns false for events with empty attendees list", () => {
      const event = { attendees: [] };
      expect(isUserInvolvedInEvent(event, userEmail)).toBe(false);
    });
  });

  describe("shouldIncludeEvent", () => {
    const userEmail = "user@example.com";

    it("returns true for explicitly typed calendars regardless of attendee status", () => {
      const event = {
        attendees: [{ email: "other@example.com" }],
      };
      // Not a shared calendar without explicit type
      expect(shouldIncludeEvent(event, userEmail, "active", false)).toBe(true);
      expect(shouldIncludeEvent(event, userEmail, "availability", false)).toBe(true);
      expect(shouldIncludeEvent(event, userEmail, "reference", false)).toBe(true);
    });

    it("returns true for shared calendar when user is attendee", () => {
      const event = {
        attendees: [{ email: "user@example.com", self: true }],
      };
      expect(shouldIncludeEvent(event, userEmail, "active", true)).toBe(true);
    });

    it("returns false for shared calendar when user is not attendee", () => {
      const event = {
        attendees: [{ email: "other@example.com" }],
      };
      expect(shouldIncludeEvent(event, userEmail, "active", true)).toBe(false);
    });
  });

  describe("suggestCalendarType", () => {
    it("suggests availability for on-call calendars", () => {
      expect(suggestCalendarType("On Call Schedule")).toBe("availability");
      expect(suggestCalendarType("Oncall Rotation")).toBe("availability");
      expect(suggestCalendarType("on-call shifts")).toBe("availability");
    });

    it("suggests reference for vacation calendars", () => {
      expect(suggestCalendarType("NEA Vacation Calendar")).toBe("reference");
      expect(suggestCalendarType("Team Time Off")).toBe("reference");
      expect(suggestCalendarType("PTO Calendar")).toBe("reference");
      expect(suggestCalendarType("Out of Office")).toBe("reference");
    });

    it("suggests reference for company/social calendars", () => {
      expect(suggestCalendarType("Company Calendar")).toBe("reference");
      expect(suggestCalendarType("Social Events")).toBe("reference");
    });

    it("returns null for calendars without clear pattern", () => {
      expect(suggestCalendarType("My Calendar")).toBeNull();
      expect(suggestCalendarType("Work")).toBeNull();
      expect(suggestCalendarType("Personal")).toBeNull();
    });

    it("handles case insensitivity", () => {
      expect(suggestCalendarType("ON CALL SCHEDULE")).toBe("availability");
      expect(suggestCalendarType("vacation calendar")).toBe("reference");
    });
  });
});
