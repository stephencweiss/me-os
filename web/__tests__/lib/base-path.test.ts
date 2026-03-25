import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("withBasePath", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns path unchanged when NEXT_PUBLIC_BASE_PATH unset", async () => {
    vi.unstubAllEnvs();
    const { withBasePath } = await import("@/lib/base-path");
    expect(withBasePath("/api/foo")).toBe("/api/foo");
  });

  it("prefixes when base path set", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { withBasePath } = await import("@/lib/base-path");
    expect(withBasePath("/api/foo")).toBe("/app/me-os/api/foo");
  });
});
