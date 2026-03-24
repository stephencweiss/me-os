import { describe, expect, it } from "vitest";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect-path";

describe("safeRelativeRedirectPath", () => {
  it("allows simple paths", () => {
    expect(safeRelativeRedirectPath("/day", "/")).toBe("/day");
  });

  it("rejects open redirects", () => {
    expect(safeRelativeRedirectPath("//evil.com", "/")).toBe("/");
    expect(safeRelativeRedirectPath("https://evil.com", "/")).toBe("/");
    expect(safeRelativeRedirectPath("\\\\evil", "/")).toBe("/");
  });

  it("uses fallback for empty", () => {
    expect(safeRelativeRedirectPath(undefined, "/settings")).toBe("/settings");
  });
});
