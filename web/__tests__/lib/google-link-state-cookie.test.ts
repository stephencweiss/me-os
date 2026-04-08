import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("google-link-state-cookie", () => {
  beforeEach(() => {
    vi.stubEnv("CLERK_SECRET_KEY", "test-secret-for-hmac");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("round-trips payload without accountLabel", async () => {
    const {
      createGoogleLinkStateCookieValue,
      parseGoogleLinkStateCookieValue,
    } = await import("@/lib/google-link-state-cookie");
    const payload = {
      v: 1 as const,
      appUserId: "user-uuid",
      state: "oauth-state",
      codeVerifier: "verifier",
      exp: Date.now() + 60_000,
    };
    const cookie = createGoogleLinkStateCookieValue(payload);
    const parsed = parseGoogleLinkStateCookieValue(cookie);
    expect(parsed).toEqual(payload);
  });

  it("round-trips payload with accountLabel", async () => {
    const {
      createGoogleLinkStateCookieValue,
      parseGoogleLinkStateCookieValue,
    } = await import("@/lib/google-link-state-cookie");
    const payload = {
      v: 1 as const,
      appUserId: "user-uuid",
      state: "oauth-state",
      codeVerifier: "verifier",
      exp: Date.now() + 60_000,
      accountLabel: "work",
    };
    const cookie = createGoogleLinkStateCookieValue(payload);
    const parsed = parseGoogleLinkStateCookieValue(cookie);
    expect(parsed).toEqual(payload);
  });

  it("rejects tampered accountLabel in cookie body", async () => {
    const { createGoogleLinkStateCookieValue, parseGoogleLinkStateCookieValue } =
      await import("@/lib/google-link-state-cookie");
    const payload = {
      v: 1 as const,
      appUserId: "user-uuid",
      state: "oauth-state",
      codeVerifier: "verifier",
      exp: Date.now() + 60_000,
      accountLabel: "ok",
    };
    const cookie = createGoogleLinkStateCookieValue(payload);
    const [body, sig] = cookie.split(".");
    const json = Buffer.from(body, "base64url").toString("utf8");
    const obj = JSON.parse(json) as Record<string, unknown>;
    obj.accountLabel = "x".repeat(100);
    const tamperedBody = Buffer.from(JSON.stringify(obj), "utf8").toString(
      "base64url"
    );
    const tampered = `${tamperedBody}.${sig}`;
    expect(parseGoogleLinkStateCookieValue(tampered)).toBeNull();
  });
});
