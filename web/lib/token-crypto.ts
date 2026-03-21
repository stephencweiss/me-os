/**
 * AES-256-GCM encryption for OAuth tokens stored in linked_google_accounts.
 * Format: v1:<iv_b64url>:<ciphertext+tag_b64url>
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const VERSION = "v1";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function deriveKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be set (at least 16 characters) to encrypt or decrypt OAuth tokens"
    );
  }
  return scryptSync(raw, "meos-token-crypto-v1", KEY_LENGTH);
}

export function encryptToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, tag]);
  return `${VERSION}:${iv.toString("base64url")}:${combined.toString("base64url")}`;
}

export function decryptToken(payload: string): string {
  if (!payload.startsWith(`${VERSION}:`)) {
    throw new Error("Unsupported or invalid encrypted token payload");
  }
  const parts = payload.slice(VERSION.length + 1).split(":");
  if (parts.length !== 2) {
    throw new Error("Malformed encrypted token payload");
  }
  const [ivB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const combined = Buffer.from(dataB64, "base64url");
  if (combined.length < TAG_LENGTH) {
    throw new Error("Encrypted token data too short");
  }
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(0, combined.length - TAG_LENGTH);
  const key = deriveKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
