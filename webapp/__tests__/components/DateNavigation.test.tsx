import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateNavigation from "@/app/components/DateNavigation";

describe("DateNavigation", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the selected date", () => {
    const date = new Date("2026-03-04T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    expect(screen.getByText(/March 4, 2026/)).toBeInTheDocument();
  });

  it("renders previous and next day buttons", () => {
    const date = new Date("2026-03-04T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    expect(screen.getByLabelText("Previous day")).toBeInTheDocument();
    expect(screen.getByLabelText("Next day")).toBeInTheDocument();
  });

  it("calls onChange with previous day when clicking previous button", async () => {
    const user = userEvent.setup();
    const date = new Date("2026-03-04T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    await user.click(screen.getByLabelText("Previous day"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const calledDate = mockOnChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(3);
    expect(calledDate.getMonth()).toBe(2); // March = 2 (0-indexed)
  });

  it("calls onChange with next day when clicking next button", async () => {
    const user = userEvent.setup();
    const date = new Date("2026-03-04T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    await user.click(screen.getByLabelText("Next day"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const calledDate = mockOnChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(5);
    expect(calledDate.getMonth()).toBe(2); // March = 2 (0-indexed)
  });

  it("shows Today button when not on today", () => {
    // Use a date that's definitely not today
    const pastDate = new Date("2020-01-15T12:00:00");

    render(<DateNavigation selectedDate={pastDate} onChange={mockOnChange} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("hides Today button when on today", () => {
    const today = new Date();

    render(<DateNavigation selectedDate={today} onChange={mockOnChange} />);

    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("calls onChange with today when clicking Today button", async () => {
    const user = userEvent.setup();
    const pastDate = new Date("2020-01-15T12:00:00");

    render(<DateNavigation selectedDate={pastDate} onChange={mockOnChange} />);

    await user.click(screen.getByText("Today"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const calledDate = mockOnChange.mock.calls[0][0];
    const now = new Date();
    expect(calledDate.getDate()).toBe(now.getDate());
    expect(calledDate.getMonth()).toBe(now.getMonth());
    expect(calledDate.getFullYear()).toBe(now.getFullYear());
  });

  it("handles month boundary correctly (going back from 1st)", async () => {
    const user = userEvent.setup();
    const date = new Date("2026-03-01T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    await user.click(screen.getByLabelText("Previous day"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const calledDate = mockOnChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(28); // Feb 28, 2026
    expect(calledDate.getMonth()).toBe(1); // February = 1
  });

  it("handles month boundary correctly (going forward from last day)", async () => {
    const user = userEvent.setup();
    const date = new Date("2026-02-28T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    await user.click(screen.getByLabelText("Next day"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    const calledDate = mockOnChange.mock.calls[0][0];
    expect(calledDate.getDate()).toBe(1);
    expect(calledDate.getMonth()).toBe(2); // March = 2
  });

  it("renders date picker trigger", () => {
    const date = new Date("2026-03-04T12:00:00");

    render(<DateNavigation selectedDate={date} onChange={mockOnChange} />);

    expect(screen.getByLabelText("Select date")).toBeInTheDocument();
  });
});
