import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BulkActionBar from "@/app/components/BulkActionBar";

const mockEvents = [
  { id: "event1", summary: "Team Meeting" },
  { id: "event2", summary: "Project Review" },
  { id: "event3", summary: "Standup" },
];

describe("BulkActionBar", () => {
  const defaultProps = {
    selectedCount: 2,
    selectedEventIds: ["event1", "event2"],
    events: mockEvents,
    onApplyColor: vi.fn().mockResolvedValue(undefined),
    onClearSelection: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    it("renders nothing when selectedCount is 0", () => {
      const { container } = render(
        <BulkActionBar {...defaultProps} selectedCount={0} selectedEventIds={[]} />
      );
      // Should only render the spacer div
      expect(container.firstChild).toBeNull();
    });

    it("renders action bar when selectedCount > 0", () => {
      render(<BulkActionBar {...defaultProps} />);
      expect(screen.getByText("2 events selected")).toBeInTheDocument();
    });

    it("shows singular 'event' when only 1 selected", () => {
      render(
        <BulkActionBar
          {...defaultProps}
          selectedCount={1}
          selectedEventIds={["event1"]}
        />
      );
      expect(screen.getByText("1 event selected")).toBeInTheDocument();
    });
  });

  describe("clear selection", () => {
    it("calls onClearSelection when Clear button is clicked", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Clear"));

      expect(defaultProps.onClearSelection).toHaveBeenCalled();
    });
  });

  describe("get suggestions", () => {
    it("renders Get Suggestions button", () => {
      render(<BulkActionBar {...defaultProps} />);
      expect(screen.getByText("Get Suggestions")).toBeInTheDocument();
    });

    it("shows Loading... while fetching suggestions", async () => {
      const user = userEvent.setup();
      // Mock fetch to return a pending promise
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Get Suggestions"));

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("calls API with selected event IDs", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Get Suggestions"));

      expect(global.fetch).toHaveBeenCalledWith("/api/events/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: ["event1", "event2"] }),
      });
    });

    it("shows View Suggestions button after receiving suggestions", async () => {
      const user = userEvent.setup();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            suggestions: [
              {
                eventId: "event1",
                colorId: "4",
                colorName: "Flamingo",
                colorMeaning: "Meetings",
                confidence: 0.9,
              },
            ],
          }),
      });

      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Get Suggestions"));

      await waitFor(() => {
        expect(screen.getByText("Review 1 Suggestions")).toBeInTheDocument();
      });
    });
  });

  describe("apply color dropdown", () => {
    it("renders Apply Color button", () => {
      render(<BulkActionBar {...defaultProps} />);
      expect(screen.getByText("Apply Color")).toBeInTheDocument();
    });

    it("shows color picker dropdown when Apply Color is clicked", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));

      // Should show all 11 colors
      expect(screen.getByText("Lavender")).toBeInTheDocument();
      expect(screen.getByText("Flamingo")).toBeInTheDocument();
      expect(screen.getByText("Blueberry")).toBeInTheDocument();
      expect(screen.getByText("Tomato")).toBeInTheDocument();
    });

    it("shows color meanings in dropdown", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));

      expect(screen.getByText("1:1s / People")).toBeInTheDocument();
      expect(screen.getByText("Meetings")).toBeInTheDocument();
      expect(screen.getByText("Fitness")).toBeInTheDocument();
    });

    it("hides dropdown when clicking Apply Color again", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      expect(screen.getByText("Lavender")).toBeInTheDocument();

      await user.click(screen.getByText("Apply Color"));
      expect(screen.queryByText("1:1s / People")).not.toBeInTheDocument();
    });
  });

  describe("confirmation modal", () => {
    it("shows confirmation modal when color is selected", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(
        screen.getByText("Apply Color to 2 Events")
      ).toBeInTheDocument();
    });

    it("shows selected events in confirmation modal", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(screen.getByText("• Team Meeting")).toBeInTheDocument();
      expect(screen.getByText("• Project Review")).toBeInTheDocument();
    });

    it("shows color name and meaning in confirmation modal", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      // The color name appears twice - once in dropdown (now closed) and once in modal
      const modalTitle = screen.getByText("Apply Color to 2 Events");
      expect(modalTitle).toBeInTheDocument();

      // Check for the meaning in the modal context
      const meaningElements = screen.getAllByText("Meetings");
      expect(meaningElements.length).toBeGreaterThan(0);
    });

    it("shows Apply to Local + Google Calendar button", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(
        screen.getByText("Apply to Local + Google Calendar")
      ).toBeInTheDocument();
    });

    it("shows Apply to Local Only button", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(screen.getByText("Apply to Local Only")).toBeInTheDocument();
    });

    it("shows Cancel button", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("closes modal when Cancel is clicked", async () => {
      const user = userEvent.setup();
      render(<BulkActionBar {...defaultProps} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));

      expect(screen.getByText("Apply Color to 2 Events")).toBeInTheDocument();

      await user.click(screen.getByText("Cancel"));

      expect(
        screen.queryByText("Apply Color to 2 Events")
      ).not.toBeInTheDocument();
    });
  });

  describe("applying colors", () => {
    it("calls onApplyColor with colorId and syncToGoogle=true for Google sync", async () => {
      const user = userEvent.setup();
      const onApplyColor = vi.fn().mockResolvedValue(undefined);
      render(<BulkActionBar {...defaultProps} onApplyColor={onApplyColor} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));
      await user.click(screen.getByText("Apply to Local + Google Calendar"));

      expect(onApplyColor).toHaveBeenCalledWith("4", true);
    });

    it("calls onApplyColor with colorId and syncToGoogle=false for local only", async () => {
      const user = userEvent.setup();
      const onApplyColor = vi.fn().mockResolvedValue(undefined);
      render(<BulkActionBar {...defaultProps} onApplyColor={onApplyColor} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));
      await user.click(screen.getByText("Apply to Local Only"));

      expect(onApplyColor).toHaveBeenCalledWith("4", false);
    });

    it("calls onClearSelection after successful apply", async () => {
      const user = userEvent.setup();
      const onApplyColor = vi.fn().mockResolvedValue(undefined);
      const onClearSelection = vi.fn();
      render(
        <BulkActionBar
          {...defaultProps}
          onApplyColor={onApplyColor}
          onClearSelection={onClearSelection}
        />
      );

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));
      await user.click(screen.getByText("Apply to Local Only"));

      await waitFor(() => {
        expect(onClearSelection).toHaveBeenCalled();
      });
    });

    it("shows Applying... while processing", async () => {
      const user = userEvent.setup();
      const onApplyColor = vi.fn().mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );
      render(<BulkActionBar {...defaultProps} onApplyColor={onApplyColor} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));
      await user.click(screen.getByText("Apply to Local + Google Calendar"));

      expect(screen.getByText("Applying...")).toBeInTheDocument();
    });

    it("closes modal after successful apply", async () => {
      const user = userEvent.setup();
      const onApplyColor = vi.fn().mockResolvedValue(undefined);
      render(<BulkActionBar {...defaultProps} onApplyColor={onApplyColor} />);

      await user.click(screen.getByText("Apply Color"));
      await user.click(screen.getByText("Flamingo"));
      await user.click(screen.getByText("Apply to Local Only"));

      await waitFor(() => {
        expect(
          screen.queryByText("Apply Color to 2 Events")
        ).not.toBeInTheDocument();
      });
    });
  });
});
