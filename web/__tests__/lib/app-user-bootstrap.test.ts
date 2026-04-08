import { describe, expect, it } from "vitest";
import {
  displayNameFromClerkWebhookUser,
  primaryEmailFromClerkWebhookUser,
} from "@/lib/app-user-bootstrap";

describe("displayNameFromClerkWebhookUser", () => {
  it("joins first and last name", () => {
    expect(
      displayNameFromClerkWebhookUser({
        first_name: "Ada",
        last_name: "Lovelace",
      })
    ).toBe("Ada Lovelace");
  });

  it("falls back to username", () => {
    expect(
      displayNameFromClerkWebhookUser({
        first_name: null,
        last_name: null,
        username: "ada42",
      })
    ).toBe("ada42");
  });

  it("returns null when empty", () => {
    expect(
      displayNameFromClerkWebhookUser({
        first_name: "",
        last_name: "",
        username: "   ",
      })
    ).toBe(null);
  });
});

describe("primaryEmailFromClerkWebhookUser", () => {
  it("uses first email_addresses entry", () => {
    expect(
      primaryEmailFromClerkWebhookUser({
        email_addresses: [{ email_address: "a@b.com" }],
      })
    ).toBe("a@b.com");
  });

  it("returns null when missing", () => {
    expect(primaryEmailFromClerkWebhookUser({ email_addresses: [] })).toBe(null);
  });
});
