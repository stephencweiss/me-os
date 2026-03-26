import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveAuthRedirectUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("joins relative path to origin only when no base path", async () => {
    vi.unstubAllEnvs();
    const { resolveAuthRedirectUrl: fn } = await import("@/lib/auth-redirect");
    expect(fn("/today", "https://example.com")).toBe("https://example.com/today");
  });

  it("prefixes NEXT_PUBLIC_BASE_PATH for relative URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { resolveAuthRedirectUrl: fn } = await import("@/lib/auth-redirect");
    expect(fn("/today", "https://www.example.com")).toBe(
      "https://www.example.com/app/me-os/today"
    );
  });

  it("fixes same-origin absolute URL missing mount", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { resolveAuthRedirectUrl: fn } = await import("@/lib/auth-redirect");
    expect(fn("https://www.example.com/today", "https://www.example.com")).toBe(
      "https://www.example.com/app/me-os/today"
    );
  });

  it("leaves same-origin URL unchanged when path already under mount", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { resolveAuthRedirectUrl: fn } = await import("@/lib/auth-redirect");
    const url = "https://www.example.com/app/me-os/today?week=1";
    expect(fn(url, "https://www.example.com")).toBe(url);
  });
});
