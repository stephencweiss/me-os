import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DayView from "@/app/components/DayView";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockEvents = [
  {
    id: "event1:2026-03-03",
    date: "2026-03-03",
    summary: "Morning Standup",
    calendar_name: "Work",
    account: "work@example.com",
    start_time: "09:00:00",
    end_time: "09:30:00",
    duration_minutes: 30,
    color_id: "4",
    color_name: "Flamingo",
    color_meaning: "Meetings",
    attended: "unknown",
    is_all_day: 0,
  },
  {
    id: "event2:2026-03-03",
    date: "2026-03-03",
    summary: "Project Planning",
    calendar_name: "Work",
    account: "work@example.com",
    start_time: "10:00:00",
    end_time: "11:00:00",
    duration_minutes: 60,
    color_id: "3",
    color_name: "Grape",
    color_meaning: "Project Work",
    attended: "attended",
    is_all_day: 0,
  },
];

const mockCalendarsResponse = {
  calendars: [{ calendar_name: "Work", account: "work@example.com" }],
  accounts: ["work@example.com"],
  byAccount: [{ account: "work@example.com", calendars: ["Work"] }],
};

// Helper to create mock fetch that handles both endpoints
function createMockFetch(eventsResponse: unknown, options?: { calendarsResponse?: unknown }) {
  return (url: string) => {
    if (url.includes("/api/calendars")) {
      return Promise.resolve({
        ok: true,
        json: async () => options?.calendarsResponse ?? mockCalendarsResponse,
      });
    }
    if (url.includes("/api/events")) {
      return Promise.resolve(eventsResponse);
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  };
}

describe("DayView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DayView />);

    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });

  it("renders events after loading", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: mockEvents,
          count: 2,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    });

    expect(screen.getByText("Project Planning")).toBeInTheDocument();
    // Event count is displayed as just the number "2" next to "Events" label
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders empty state when no events", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: [],
          count: 0,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(
        screen.getByText("No events scheduled for today")
      ).toBeInTheDocument();
    });
  });

  it("renders error state on fetch failure", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: false,
        json: async () => ({ error: "Server error" }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Failed to fetch events")).toBeInTheDocument();
    });
  });

  it("displays total scheduled time correctly", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: mockEvents,
          count: 2,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      // 30 + 60 = 90 minutes = 1h 30m
      expect(screen.getByText("1h 30m")).toBeInTheDocument();
    });
  });

  it("displays attendance status for each event", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: mockEvents,
          count: 2,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    });

    // Each event has 3 attendance buttons PLUS the filter bar has 3 buttons
    // Filter bar: Attended, Skipped, Unknown (1 each)
    // Events: 2 events x 3 buttons = 6 buttons
    // Total: 3 + 6 = 9 buttons (3 of each type)
    const attendedButtons = screen.getAllByText("Attended");
    const skippedButtons = screen.getAllByText("Skipped");
    const unknownButtons = screen.getAllByText("Unknown");

    // 1 filter button + 2 event buttons = 3 each
    expect(attendedButtons).toHaveLength(3);
    expect(skippedButtons).toHaveLength(3);
    expect(unknownButtons).toHaveLength(3);
  });

  it("calls API when attendance button is clicked", async () => {
    const user = userEvent.setup();

    // Track calls to determine which endpoint was called
    const calls: string[] = [];
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      calls.push(url);
      if (url.includes("/api/calendars")) {
        return Promise.resolve({
          ok: true,
          json: async () => mockCalendarsResponse,
        });
      }
      if (url.includes("/api/events") && options?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            eventId: "event1:2026-03-03",
            attended: "skipped",
          }),
        });
      }
      if (url.includes("/api/events")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    });

    // Find the event's "Skipped" button (not the filter button)
    // Filter buttons have different styling (rounded-lg) vs event buttons (rounded-full)
    const skippedButtons = screen.getAllByText("Skipped");
    // The second "Skipped" button is the one for the first event (first is filter)
    await user.click(skippedButtons[1]);

    // Verify PATCH was called to update attendance
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: "event1:2026-03-03",
          attended: "skipped",
        }),
      });
    });
  });

  it("displays formatted times correctly", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: mockEvents,
          count: 2,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    });

    // Check formatted times
    expect(screen.getByText(/9:00 AM - 9:30 AM/)).toBeInTheDocument();
    expect(screen.getByText(/10:00 AM - 11:00 AM/)).toBeInTheDocument();
  });

  it("displays calendar name for each event", async () => {
    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: mockEvents,
          count: 2,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    });

    // Both events are from "Work" calendar
    const workLabels = screen.getAllByText("Work");
    expect(workLabels).toHaveLength(2);
  });

  it("displays All Day pill for all-day events", async () => {
    const allDayEvent = {
      id: "allday1:2026-03-03",
      date: "2026-03-03",
      summary: "Company Holiday",
      calendar_name: "Work",
      account: "work@example.com",
      start_time: "2026-03-03T06:00:00.000Z",
      end_time: "2026-03-04T06:00:00.000Z",
      duration_minutes: 0,
      color_id: "5",
      color_name: "Banana",
      color_meaning: "Household / Pets",
      attended: "unknown",
      is_all_day: 1,
    };

    mockFetch.mockImplementation(
      createMockFetch({
        ok: true,
        json: async () => ({
          events: [allDayEvent],
          count: 1,
          dateRange: { start: "2026-03-03", end: "2026-03-03" },
        }),
      })
    );

    render(<DayView />);

    await waitFor(() => {
      expect(screen.getByText("Company Holiday")).toBeInTheDocument();
    });

    // Should show "All Day" pill instead of time
    expect(screen.getByText("All Day")).toBeInTheDocument();
    // Should NOT show time range like "1:00 AM - 2:00 AM" for all-day events
    expect(screen.queryByText(/-/)).not.toBeInTheDocument();
  });

  describe("selection mode", () => {
    it("shows Select button by default", async () => {
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Select")).toBeInTheDocument();
      });
    });

    it("does not show checkboxes by default", async () => {
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      const checkboxes = screen.queryAllByRole("checkbox");
      expect(checkboxes).toHaveLength(0);
    });

    it("enters selection mode when Select button is clicked", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Select")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      // Button should change to "Done"
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("shows checkboxes when in selection mode", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes).toHaveLength(2); // One for each event
    });

    it("shows Select All button in selection mode", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      expect(screen.getByText("Select All")).toBeInTheDocument();
    });

    it("exits selection mode when Done button is clicked", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Select")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));
      expect(screen.getByText("Done")).toBeInTheDocument();

      await user.click(screen.getByText("Done"));
      expect(screen.getByText("Select")).toBeInTheDocument();
    });

    it("selects event when checkbox is clicked", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(checkboxes[0]).toBeChecked();
    });

    it("deselects event when checkbox is clicked again", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      expect(checkboxes[0]).toBeChecked();

      await user.click(checkboxes[0]);
      expect(checkboxes[0]).not.toBeChecked();
    });

    it("shows selection count in header", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(screen.getByText("(1 selected)")).toBeInTheDocument();
    });

    it("selects all events when Select All is clicked", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));
      await user.click(screen.getByText("Select All"));

      const checkboxes = screen.getAllByRole("checkbox");
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeChecked();
      });

      expect(screen.getByText("(2 selected)")).toBeInTheDocument();
    });

    it("shows Clear button in header when events are selected", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      // Clear button should not be visible before selection
      const headerClearButtons = screen.queryAllByRole("button", { name: "Clear" });
      expect(headerClearButtons).toHaveLength(0);

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // Clear buttons should appear (one in header, one in BulkActionBar)
      const clearButtons = screen.getAllByRole("button", { name: "Clear" });
      expect(clearButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("clears selection when Clear button in header is clicked", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      expect(screen.getByText("(1 selected)")).toBeInTheDocument();

      // Click the first Clear button (header is before BulkActionBar in DOM)
      const clearButtons = screen.getAllByRole("button", { name: "Clear" });
      await user.click(clearButtons[0]);

      expect(screen.queryByText("(1 selected)")).not.toBeInTheDocument();
      expect(checkboxes[0]).not.toBeChecked();
    });

    it("shows bulk action bar when events are selected", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      // BulkActionBar shows "1 event selected"
      expect(screen.getByText("1 event selected")).toBeInTheDocument();
    });

    it("clears selection when exiting selection mode", async () => {
      const user = userEvent.setup();
      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: mockEvents,
            count: 2,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Select"));

      // Select an event
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);
      expect(screen.getByText("(1 selected)")).toBeInTheDocument();

      // Exit selection mode
      await user.click(screen.getByText("Done"));

      // Re-enter selection mode
      await user.click(screen.getByText("Select"));

      // Selection should be cleared
      expect(screen.queryByText("(1 selected)")).not.toBeInTheDocument();
    });
  });

  describe("uncategorized event styling", () => {
    it("highlights uncategorized events with amber styling", async () => {
      const uncategorizedEvent = {
        id: "uncat1:2026-03-03",
        date: "2026-03-03",
        summary: "Uncategorized Event",
        calendar_name: "Work",
        account: "work@example.com",
        start_time: "14:00:00",
        end_time: "15:00:00",
        duration_minutes: 60,
        color_id: "default",
        color_name: "",
        color_meaning: "",
        attended: "unknown",
        is_all_day: 0,
      };

      mockFetch.mockImplementation(
        createMockFetch({
          ok: true,
          json: async () => ({
            events: [uncategorizedEvent],
            count: 1,
            dateRange: { start: "2026-03-03", end: "2026-03-03" },
          }),
        })
      );

      const { container } = render(<DayView />);

      await waitFor(() => {
        expect(screen.getByText("Uncategorized Event")).toBeInTheDocument();
      });

      // Find the event container with amber styling - the outer div has border-l-4 and border-amber classes
      const amberBorderedElement = container.querySelector(".border-l-4.border-amber-400");
      expect(amberBorderedElement).not.toBeNull();
      expect(amberBorderedElement).toHaveClass("bg-amber-50");
    });
  });
});
