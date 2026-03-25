import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getAuthDeploymentUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses trimmed quoted URL and returns origin only", async () => {
    vi.stubEnv("AUTH_URL", '  "http://localhost:3000/"  ');
    vi.stubEnv("NEXTAUTH_URL", "");
    const { getAuthDeploymentUrl } = await import("@/lib/auth-deployment-url");
    expect(getAuthDeploymentUrl()).toBe("http://localhost:3000");
  });

  it("rejects non-http(s) protocol", async () => {
    vi.stubEnv("AUTH_URL", "capacitor://localhost");
    vi.stubEnv("NEXTAUTH_URL", "");
    const { getAuthDeploymentUrl } = await import("@/lib/auth-deployment-url");
    expect(() => getAuthDeploymentUrl()).toThrow(/http:/);
  });
});
