import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: null }),
}));

vi.mock("@/lib/auth-helpers", () => ({
  requireAuthUnlessLocal: vi.fn().mockResolvedValue({
    authorized: true,
    userId: "test-user",
    email: "test@example.com",
  }),
}));

// Mock the db module used by the route
vi.mock("@/lib/db-unified", () => ({
  updateEventColor: vi.fn(),
  getEventById: vi.fn(),
  COLOR_DEFINITIONS: {
    "1": { name: "Lavender", meaning: "1:1s / People" },
    "4": { name: "Flamingo", meaning: "Meetings" },
    "9": { name: "Blueberry", meaning: "Fitness" },
  },
}));

// Mock the google-calendar-client module
vi.mock("@/lib/google-calendar-client", () => ({
  updateGoogleEventColor: vi.fn(),
  isGoogleSyncConfigured: vi.fn(),
}));

import { POST } from "@/app/api/events/bulk-color/route";
import { updateEventColor, getEventById } from "@/lib/db-unified";
import {
  updateGoogleEventColor,
  isGoogleSyncConfigured,
} from "@/lib/google-calendar-client";

describe("POST /api/events/bulk-color", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/events/bulk-color", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  describe("validation", () => {
    it("returns 400 when updates array is missing", async () => {
      const request = createRequest({});
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("updates array is required");
    });

    it("returns 400 when updates is not an array", async () => {
      const request = createRequest({ updates: "not-an-array" });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("updates array is required");
    });

    it("returns 400 when batch size exceeds 100", async () => {
      const updates = Array.from({ length: 101 }, (_, i) => ({
        eventId: `event-${i}`,
        colorId: "4",
      }));
      const request = createRequest({ updates, syncToGoogle: false });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Maximum 100 events per request");
    });

    it("returns success with 0 updated when updates array is empty", async () => {
      const request = createRequest({ updates: [], syncToGoogle: false });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated).toBe(0);
    });
  });

  describe("local database updates", () => {
    it("updates event color in database", async () => {
      const mockEvent = {
        id: "event-1",
        google_event_id: "google-123",
        account: "personal",
        summary: "Test Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(false);

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated).toBe(1);
      expect(updateEventColor).toHaveBeenCalledWith("test-user", "event-1", "4");
    });

    it("returns error for invalid colorId", async () => {
      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "99" }], // Invalid color
        syncToGoogle: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.results[0].error).toContain("Invalid colorId");
    });

    it("returns error when event not found", async () => {
      vi.mocked(getEventById).mockResolvedValue(null);

      const request = createRequest({
        updates: [{ eventId: "nonexistent", colorId: "4" }],
        syncToGoogle: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.results[0].error).toBe("Event not found");
    });
  });

  describe("Google Calendar sync", () => {
    it("syncs to Google Calendar when syncToGoogle is true", async () => {
      // This test uses realistic event data with account NAME (not email)
      // This would have caught the bug where account names weren't handled
      const mockEvent = {
        id: "event-1",
        google_event_id: "google-123",
        account: "personal", // Account NAME, not email - this is what DB stores
        summary: "Test Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);
      vi.mocked(updateGoogleEventColor).mockResolvedValue({
        success: true,
        googleUpdated: true,
      });

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.googleSynced).toBe(1);
      // Verify the account NAME is passed (this is the critical assertion)
      expect(updateGoogleEventColor).toHaveBeenCalledWith(
        "google-123", // google_event_id
        "personal", // account (NAME, not email)
        "4" // colorId
      );
    });

    it("syncs work account events to Google Calendar", async () => {
      const mockEvent = {
        id: "event-2",
        google_event_id: "google-456",
        account: "work", // Work account NAME
        summary: "Work Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "9" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);
      vi.mocked(updateGoogleEventColor).mockResolvedValue({
        success: true,
        googleUpdated: true,
      });

      const request = createRequest({
        updates: [{ eventId: "event-2", colorId: "9" }],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.googleSynced).toBe(1);
      expect(updateGoogleEventColor).toHaveBeenCalledWith(
        "google-456",
        "work", // Work account NAME
        "9"
      );
    });

    it("skips Google sync when syncToGoogle is false", async () => {
      const mockEvent = {
        id: "event-1",
        google_event_id: "google-123",
        account: "personal",
        summary: "Test Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(data.googleSynced).toBe(0);
      expect(updateGoogleEventColor).not.toHaveBeenCalled();
    });

    it("adds warning when Google sync is not configured", async () => {
      const mockEvent = {
        id: "event-1",
        google_event_id: "google-123",
        account: "personal",
        summary: "Test Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(false); // Not configured

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(data.googleSynced).toBe(0);
      expect(data.results[0].warning).toBe("Google Calendar sync not configured");
    });

    it("adds warning when event has no Google Calendar ID", async () => {
      const mockEvent = {
        id: "event-1",
        google_event_id: null, // No Google ID
        account: "personal",
        summary: "Local Event",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(data.googleSynced).toBe(0);
      expect(data.results[0].warning).toBe("Event has no Google Calendar ID");
    });

    it("handles Google API errors gracefully", async () => {
      const mockEvent = {
        id: "event-1",
        google_event_id: "google-123",
        account: "personal",
        summary: "Test Meeting",
      };

      vi.mocked(getEventById).mockResolvedValue(mockEvent as any);
      vi.mocked(updateEventColor).mockResolvedValue({ ...mockEvent, color_id: "4" } as any);
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);
      vi.mocked(updateGoogleEventColor).mockRejectedValue(
        new Error("Network error")
      );

      const request = createRequest({
        updates: [{ eventId: "event-1", colorId: "4" }],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.updated).toBe(1);
      expect(data.googleSynced).toBe(0);
      expect(data.results[0].warning).toContain("Google sync failed");
    });
  });

  describe("bulk operations", () => {
    it("processes multiple events in a single request", async () => {
      const mockEvents = [
        { id: "event-1", google_event_id: "g1", account: "personal", summary: "Meeting 1" },
        { id: "event-2", google_event_id: "g2", account: "work", summary: "Meeting 2" },
        { id: "event-3", google_event_id: "g3", account: "personal", summary: "Meeting 3" },
      ];

      vi.mocked(getEventById).mockImplementation(async (_userId, eventId) =>
        mockEvents.find((e) => e.id === eventId) as any
      );
      vi.mocked(updateEventColor).mockImplementation(async (_userId, eventId, colorId) => {
        const event = mockEvents.find((e) => e.id === eventId);
        return { ...event, color_id: colorId } as any;
      });
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(true);
      vi.mocked(updateGoogleEventColor).mockResolvedValue({
        success: true,
        googleUpdated: true,
      });

      const request = createRequest({
        updates: [
          { eventId: "event-1", colorId: "4" },
          { eventId: "event-2", colorId: "9" },
          { eventId: "event-3", colorId: "1" },
        ],
        syncToGoogle: true,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.updated).toBe(3);
      expect(data.googleSynced).toBe(3);
      expect(data.results).toHaveLength(3);
      expect(data.results.every((r: any) => r.success)).toBe(true);
    });

    it("handles partial failures gracefully", async () => {
      const mockEvents = [
        { id: "event-1", google_event_id: "g1", account: "personal", summary: "Meeting 1" },
        // event-2 doesn't exist
        { id: "event-3", google_event_id: "g3", account: "personal", summary: "Meeting 3" },
      ];

      vi.mocked(getEventById).mockImplementation(async (_userId, eventId) => {
        const found = mockEvents.find((e) => e.id === eventId);
        return (found ?? null) as any;
      });
      vi.mocked(updateEventColor).mockImplementation(async (_userId, eventId, colorId) => {
        const event = mockEvents.find((e) => e.id === eventId);
        return event ? ({ ...event, color_id: colorId } as any) : null;
      });
      vi.mocked(isGoogleSyncConfigured).mockReturnValue(false);

      const request = createRequest({
        updates: [
          { eventId: "event-1", colorId: "4" },
          { eventId: "event-2", colorId: "4" }, // This one doesn't exist
          { eventId: "event-3", colorId: "4" },
        ],
        syncToGoogle: false,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false); // Partial failure
      expect(data.updated).toBe(2);
      expect(data.errors).toHaveLength(1);
      expect(data.errors[0].eventId).toBe("event-2");
    });
  });
});
