import { describe, expect, it } from "vitest";
import { authPathnameForAuthJs } from "@/lib/auth-request-url";

describe("authPathnameForAuthJs", () => {
  it("leaves paths unchanged when no Next basePath", () => {
    expect(authPathnameForAuthJs("/api/auth/callback/google", "")).toBe(
      "/api/auth/callback/google"
    );
  });

  it("prefixes /api/auth when Next uses basePath (stripped from req.url)", () => {
    expect(
      authPathnameForAuthJs("/api/auth/callback/google", "/app/me-os")
    ).toBe("/app/me-os/api/auth/callback/google");
  });

  it("does not double-prefix", () => {
    expect(
      authPathnameForAuthJs(
        "/app/me-os/api/auth/callback/google",
        "/app/me-os"
      )
    ).toBe("/app/me-os/api/auth/callback/google");
  });
});
