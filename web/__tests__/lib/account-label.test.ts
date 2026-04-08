import { describe, expect, it } from "vitest";
import {
  ACCOUNT_LABEL_MAX_LENGTH,
  parseAccountLabelQueryParam,
  resolveLinkedGoogleAccountLabel,
} from "@/lib/account-label";

describe("parseAccountLabelQueryParam", () => {
  it("returns undefined for absent or blank", () => {
    expect(parseAccountLabelQueryParam(undefined)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(parseAccountLabelQueryParam(null)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(parseAccountLabelQueryParam("")).toEqual({
      ok: true,
      value: undefined,
    });
    expect(parseAccountLabelQueryParam("   ")).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("accepts valid trimmed label", () => {
    expect(parseAccountLabelQueryParam("  work  ")).toEqual({
      ok: true,
      value: "work",
    });
  });

  it("rejects label over max length", () => {
    const long = "a".repeat(ACCOUNT_LABEL_MAX_LENGTH + 1);
    const r = parseAccountLabelQueryParam(long);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/at most/);
    }
  });

  it("rejects control characters", () => {
    const r = parseAccountLabelQueryParam("bad\nlabel");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/control/);
    }
  });
});

describe("resolveLinkedGoogleAccountLabel", () => {
  it("uses preferred label when valid", () => {
    expect(
      resolveLinkedGoogleAccountLabel("work", "a@b.com", "sub123")
    ).toBe("work");
  });

  it("falls back to email when no preferred", () => {
    expect(resolveLinkedGoogleAccountLabel(undefined, "a@b.com", "sub")).toBe(
      "a@b.com"
    );
  });

  it("ignores invalid preferred and uses email", () => {
    expect(
      resolveLinkedGoogleAccountLabel("x\ny", "a@b.com", "sub")
    ).toBe("a@b.com");
  });

  it("falls back to sub prefix when email empty", () => {
    expect(resolveLinkedGoogleAccountLabel(undefined, "", "googleSubject9")).toBe(
      "google:googleSubject9"
    );
  });
});
