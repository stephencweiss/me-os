import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttendanceFilter from "@/app/components/AttendanceFilter";

describe("AttendanceFilter", () => {
  it("renders all filter buttons", () => {
    const onChange = vi.fn();
    render(<AttendanceFilter selected={[]} onChange={onChange} />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Attended")).toBeInTheDocument();
    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("shows All as active when no filters selected", () => {
    const onChange = vi.fn();
    render(<AttendanceFilter selected={[]} onChange={onChange} />);

    const allButton = screen.getByText("All");
    expect(allButton).toHaveClass("bg-blue-100");
  });

  it("shows All as active when all three filters selected", () => {
    const onChange = vi.fn();
    render(
      <AttendanceFilter
        selected={["attended", "skipped", "unknown"]}
        onChange={onChange}
      />
    );

    const allButton = screen.getByText("All");
    expect(allButton).toHaveClass("bg-blue-100");
  });

  it("shows individual filter as active when selected", () => {
    const onChange = vi.fn();
    render(<AttendanceFilter selected={["attended"]} onChange={onChange} />);

    const attendedButton = screen.getByText("Attended");
    expect(attendedButton).toHaveClass("bg-green-100");

    // All should not be active
    const allButton = screen.getByText("All");
    expect(allButton).not.toHaveClass("bg-blue-100");
  });

  it("calls onChange with filter added when clicking unselected filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttendanceFilter selected={[]} onChange={onChange} />);

    await user.click(screen.getByText("Attended"));

    expect(onChange).toHaveBeenCalledWith(["attended"]);
  });

  it("calls onChange with filter removed when clicking selected filter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttendanceFilter selected={["attended"]} onChange={onChange} />);

    await user.click(screen.getByText("Attended"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("calls onChange with empty array when clicking All", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AttendanceFilter selected={["attended", "skipped"]} onChange={onChange} />
    );

    await user.click(screen.getByText("All"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("allows multiple filters to be selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AttendanceFilter selected={["attended"]} onChange={onChange} />);

    await user.click(screen.getByText("Skipped"));

    expect(onChange).toHaveBeenCalledWith(["attended", "skipped"]);
  });

  it("displays correct styling for skipped filter when active", () => {
    const onChange = vi.fn();
    render(<AttendanceFilter selected={["skipped"]} onChange={onChange} />);

    const skippedButton = screen.getByText("Skipped");
    expect(skippedButton).toHaveClass("bg-red-100");
  });

  it("displays correct styling for unknown filter when active", () => {
    const onChange = vi.fn();
    render(<AttendanceFilter selected={["unknown"]} onChange={onChange} />);

    const unknownButton = screen.getByText("Unknown");
    expect(unknownButton).toHaveClass("bg-gray-100");
  });

  describe("uncategorized toggle", () => {
    it("does not show uncategorized button when onUncategorizedChange is not provided", () => {
      const onChange = vi.fn();
      render(<AttendanceFilter selected={[]} onChange={onChange} />);

      expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument();
    });

    it("shows uncategorized button when onUncategorizedChange is provided", () => {
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      expect(screen.getByText("Uncategorized")).toBeInTheDocument();
    });

    it("displays inactive styling when uncategorizedOnly is false", () => {
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          uncategorizedOnly={false}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      const uncategorizedButton = screen.getByText("Uncategorized");
      expect(uncategorizedButton).not.toHaveClass("bg-amber-100");
      expect(uncategorizedButton).toHaveClass("bg-white");
    });

    it("displays active styling when uncategorizedOnly is true", () => {
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          uncategorizedOnly={true}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      const uncategorizedButton = screen.getByText("Uncategorized");
      expect(uncategorizedButton).toHaveClass("bg-amber-100");
    });

    it("calls onUncategorizedChange with true when clicking inactive uncategorized", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          uncategorizedOnly={false}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      await user.click(screen.getByText("Uncategorized"));

      expect(onUncategorizedChange).toHaveBeenCalledWith(true);
    });

    it("calls onUncategorizedChange with false when clicking active uncategorized", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          uncategorizedOnly={true}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      await user.click(screen.getByText("Uncategorized"));

      expect(onUncategorizedChange).toHaveBeenCalledWith(false);
    });

    it("renders separator between attendance filters and uncategorized toggle", () => {
      const onChange = vi.fn();
      const onUncategorizedChange = vi.fn();
      render(
        <AttendanceFilter
          selected={[]}
          onChange={onChange}
          onUncategorizedChange={onUncategorizedChange}
        />
      );

      // The separator is a | character
      expect(screen.getByText("|")).toBeInTheDocument();
    });
  });
});
