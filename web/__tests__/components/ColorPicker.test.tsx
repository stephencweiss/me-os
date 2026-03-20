import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColorPicker, { COLOR_OPTIONS } from "@/app/components/ColorPicker";

describe("ColorPicker", () => {
  it("renders the color indicator button", () => {
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Change color (currently Meetings)");
  });

  it("has correct background color for current selection", () => {
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ backgroundColor: "#e67c73" }); // Flamingo
  });

  it("does not show dropdown initially", () => {
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    // Dropdown should not be visible
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("renders all 11 color options in dropdown", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(11);
  });

  it("displays color meanings in dropdown", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    // Check some meanings are displayed
    expect(screen.getByText("1:1s / People")).toBeInTheDocument();
    expect(screen.getByText("Project Work")).toBeInTheDocument();
    expect(screen.getByText("Meetings")).toBeInTheDocument();
  });

  it("displays color names in dropdown", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    // Check some names are displayed
    expect(screen.getByText("Lavender")).toBeInTheDocument();
    expect(screen.getByText("Grape")).toBeInTheDocument();
    expect(screen.getByText("Flamingo")).toBeInTheDocument();
  });

  it("marks current color with checkmark", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    // Flamingo option should have checkmark
    expect(screen.getByText("✓")).toBeInTheDocument();
  });

  it("calls onSelect when a color is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));

    // Click on Grape (id: 3)
    const grapeOption = screen.getByText("Grape").closest("button");
    await user.click(grapeOption!);

    expect(onSelect).toHaveBeenCalledWith("3");
  });

  it("closes dropdown after selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    const grapeOption = screen.getByText("Grape").closest("button");
    await user.click(grapeOption!);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape key", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("can open dropdown with keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="1" onSelect={onSelect} />);

    // Focus the button first
    screen.getByRole("button").focus();

    // Press Enter to open dropdown
    await user.keyboard("{Enter}");

    // Dropdown should be open
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("has correct aria attributes on trigger button", () => {
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-haspopup", "listbox");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("updates aria-expanded when open", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="4" onSelect={onSelect} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("defaults to first color if invalid colorId provided", () => {
    const onSelect = vi.fn();
    render(<ColorPicker currentColorId="999" onSelect={onSelect} />);

    const button = screen.getByRole("button");
    // Should fallback to first color (Lavender)
    expect(button).toHaveStyle({ backgroundColor: "#7986cb" });
  });
});

describe("COLOR_OPTIONS", () => {
  it("exports all 11 color options", () => {
    expect(COLOR_OPTIONS).toHaveLength(11);
  });

  it("has correct structure for each option", () => {
    for (const option of COLOR_OPTIONS) {
      expect(option).toHaveProperty("id");
      expect(option).toHaveProperty("name");
      expect(option).toHaveProperty("meaning");
      expect(option).toHaveProperty("hex");
    }
  });

  it("has unique IDs", () => {
    const ids = COLOR_OPTIONS.map((o) => o.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
