import { describe, expect, it } from "vitest";
import { normalizeMobileOAuthScheme } from "@/lib/mobile-oauth-deep-link";

describe("normalizeMobileOAuthScheme", () => {
  it("trims and strips trailing colon", () => {
    expect(normalizeMobileOAuthScheme("meos")).toBe("meos");
    expect(normalizeMobileOAuthScheme("meos:")).toBe("meos");
    expect(normalizeMobileOAuthScheme("  meos  ")).toBe("meos");
  });

  it("rejects invalid schemes", () => {
    expect(normalizeMobileOAuthScheme("")).toBe("meos");
    expect(normalizeMobileOAuthScheme("9bad")).toBe("meos");
    expect(normalizeMobileOAuthScheme("has/slash")).toBe("meos");
  });
});
