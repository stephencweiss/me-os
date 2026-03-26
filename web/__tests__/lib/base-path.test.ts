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

describe("pathnameWithinBasePath", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns pathname unchanged when base unset", async () => {
    vi.unstubAllEnvs();
    const { pathnameWithinBasePath } = await import("@/lib/base-path");
    expect(pathnameWithinBasePath("/login")).toBe("/login");
  });

  it("strips base prefix for middleware-style paths", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { pathnameWithinBasePath } = await import("@/lib/base-path");
    expect(pathnameWithinBasePath("/app/me-os")).toBe("/");
    expect(pathnameWithinBasePath("/app/me-os/login")).toBe("/login");
    expect(pathnameWithinBasePath("/app/me-os/api/auth/callback/google")).toBe(
      "/api/auth/callback/google"
    );
    expect(pathnameWithinBasePath("/app/me-os/_next/static/chunk.js")).toBe(
      "/_next/static/chunk.js"
    );
  });
});

describe("getAuthJsBasePath", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns /api/auth when no Next base path", async () => {
    vi.unstubAllEnvs();
    const { getAuthJsBasePath } = await import("@/lib/base-path");
    expect(getAuthJsBasePath()).toBe("/api/auth");
  });

  it("prefixes api/auth under Next basePath", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app/me-os");
    const { getAuthJsBasePath } = await import("@/lib/base-path");
    expect(getAuthJsBasePath()).toBe("/app/me-os/api/auth");
  });
});
