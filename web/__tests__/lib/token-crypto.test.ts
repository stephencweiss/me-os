import { afterEach, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

describe("token-crypto", () => {
  afterEach(() => {
    delete process.env.TOKEN_ENCRYPTION_KEY;
  });

  it("round-trips plaintext", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "test-encryption-key-min-16";
    const plain = "ya29.access-token-example";
    const enc = encryptToken(plain);
    expect(enc).toMatch(/^v1:/);
    expect(decryptToken(enc)).toBe(plain);
  });

  it("throws on wrong key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "first-key-at-least-16";
    const enc = encryptToken("secret");
    process.env.TOKEN_ENCRYPTION_KEY = "other-key-at-least-16";
    expect(() => decryptToken(enc)).toThrow();
  });
});
