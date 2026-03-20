import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryBreakdown, {
  aggregateByCategory,
} from "@/app/components/CategoryBreakdown";

const mockEvents = [
  {
    id: "event1",
    color_id: "4",
    color_name: "Flamingo",
    color_meaning: "Meetings",
    duration_minutes: 30,
  },
  {
    id: "event2",
    color_id: "3",
    color_name: "Grape",
    color_meaning: "Project Work",
    duration_minutes: 60,
  },
  {
    id: "event3",
    color_id: "4",
    color_name: "Flamingo",
    color_meaning: "Meetings",
    duration_minutes: 45,
  },
  {
    id: "event4",
    color_id: "9",
    color_name: "Blueberry",
    color_meaning: "Fitness",
    duration_minutes: 60,
  },
];

describe("aggregateByCategory", () => {
  it("groups events by color and sums durations", () => {
    const result = aggregateByCategory(mockEvents);

    expect(result).toHaveLength(3);

    // Find the Meetings category (color_id 4)
    const meetings = result.find((c) => c.colorId === "4");
    expect(meetings).toBeDefined();
    expect(meetings!.totalMinutes).toBe(75); // 30 + 45
    expect(meetings!.eventCount).toBe(2);
    expect(meetings!.colorName).toBe("Flamingo");
    expect(meetings!.colorMeaning).toBe("Meetings");
  });

  it("sorts by total time descending", () => {
    const result = aggregateByCategory(mockEvents);

    // Meetings (75m) should be first, then Project Work (60m) and Fitness (60m)
    expect(result[0].colorId).toBe("4"); // 75 minutes
    expect(result[0].totalMinutes).toBe(75);
  });

  it("returns empty array for no events", () => {
    const result = aggregateByCategory([]);
    expect(result).toEqual([]);
  });

  it("handles single event correctly", () => {
    const singleEvent = [mockEvents[0]];
    const result = aggregateByCategory(singleEvent);

    expect(result).toHaveLength(1);
    expect(result[0].totalMinutes).toBe(30);
    expect(result[0].eventCount).toBe(1);
  });
});

describe("CategoryBreakdown", () => {
  it("renders nothing when events array is empty", () => {
    const { container } = render(<CategoryBreakdown events={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders category header", () => {
    render(<CategoryBreakdown events={mockEvents} />);
    expect(screen.getByText("Time by Category")).toBeInTheDocument();
  });

  it("renders all unique categories", () => {
    render(<CategoryBreakdown events={mockEvents} />);

    expect(screen.getByText("Meetings")).toBeInTheDocument();
    expect(screen.getByText("Project Work")).toBeInTheDocument();
    expect(screen.getByText("Fitness")).toBeInTheDocument();
  });

  it("displays aggregated time for each category", () => {
    render(<CategoryBreakdown events={mockEvents} />);

    // Meetings: 30 + 45 = 75 minutes = 1h 15m
    expect(screen.getByText("1h 15m")).toBeInTheDocument();
    // Project Work and Fitness both have 60 minutes = 1h
    const oneHourLabels = screen.getAllByText("1h");
    expect(oneHourLabels).toHaveLength(2);
  });

  it("displays event count for each category", () => {
    render(<CategoryBreakdown events={mockEvents} />);

    // Meetings has 2 events
    expect(screen.getByText("(2 events)")).toBeInTheDocument();
    // Project Work and Fitness have 1 event each
    const oneEventLabels = screen.getAllByText("(1 event)");
    expect(oneEventLabels).toHaveLength(2);
  });

  it("renders color indicators", () => {
    const { container } = render(<CategoryBreakdown events={mockEvents} />);

    // There should be 3 color dots (one for each unique category)
    const colorDots = container.querySelectorAll(".rounded-full");
    expect(colorDots).toHaveLength(3);
  });

  it("displays color meaning when available", () => {
    render(<CategoryBreakdown events={mockEvents} />);

    // Should display the meaning, not just the color name
    expect(screen.getByText("Meetings")).toBeInTheDocument();
    expect(screen.getByText("Project Work")).toBeInTheDocument();
  });

  it("falls back to color name when meaning is empty", () => {
    const eventsWithoutMeaning = [
      {
        id: "event1",
        color_id: "4",
        color_name: "Flamingo",
        color_meaning: "",
        duration_minutes: 30,
      },
    ];

    render(<CategoryBreakdown events={eventsWithoutMeaning} />);

    expect(screen.getByText("Flamingo")).toBeInTheDocument();
  });

  it("formats short durations correctly", () => {
    const shortEvents = [
      {
        id: "event1",
        color_id: "4",
        color_name: "Flamingo",
        color_meaning: "Meetings",
        duration_minutes: 15,
      },
    ];

    render(<CategoryBreakdown events={shortEvents} />);

    expect(screen.getByText("15m")).toBeInTheDocument();
  });
});
