import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountFilter from "@/app/components/AccountFilter";

describe("AccountFilter", () => {
  const mockAccounts = ["work@example.com", "personal@gmail.com"];

  it("returns null when only one account", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AccountFilter
        accounts={["single@example.com"]}
        selected={[]}
        onChange={onChange}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when no accounts", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AccountFilter accounts={[]} selected={[]} onChange={onChange} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders All button and account buttons", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={[]}
        onChange={onChange}
      />
    );

    expect(screen.getByText("All")).toBeInTheDocument();
    // Should display username portion of email
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
  });

  it("shows All as active when no accounts selected", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={[]}
        onChange={onChange}
      />
    );

    const allButton = screen.getByText("All");
    expect(allButton).toHaveClass("bg-blue-100");
  });

  it("shows All as active when all accounts selected", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={mockAccounts}
        onChange={onChange}
      />
    );

    const allButton = screen.getByText("All");
    expect(allButton).toHaveClass("bg-blue-100");
  });

  it("shows account as active when selected", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={["work@example.com"]}
        onChange={onChange}
      />
    );

    const workButton = screen.getByText("work");
    expect(workButton).toHaveClass("bg-purple-100");

    // All should not be active
    const allButton = screen.getByText("All");
    expect(allButton).not.toHaveClass("bg-blue-100");
  });

  it("calls onChange with account added when clicking unselected account", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={[]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText("work"));

    expect(onChange).toHaveBeenCalledWith(["work@example.com"]);
  });

  it("calls onChange with account removed when clicking selected account", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={["work@example.com"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText("work"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("calls onChange with empty array when clicking All", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={["work@example.com"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText("All"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("allows multiple accounts to be selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={["work@example.com"]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByText("personal"));

    expect(onChange).toHaveBeenCalledWith([
      "work@example.com",
      "personal@gmail.com",
    ]);
  });

  it("has title attribute with full email for truncated buttons", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={mockAccounts}
        selected={[]}
        onChange={onChange}
      />
    );

    const workButton = screen.getByText("work");
    expect(workButton).toHaveAttribute("title", "work@example.com");
  });

  it("handles non-email account names", () => {
    const onChange = vi.fn();
    render(
      <AccountFilter
        accounts={["work", "personal"]}
        selected={[]}
        onChange={onChange}
      />
    );

    // Should display full name when no @ symbol
    expect(screen.getByText("work")).toBeInTheDocument();
    expect(screen.getByText("personal")).toBeInTheDocument();
  });
});
