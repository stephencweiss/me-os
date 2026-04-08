import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

import { isValidAccountLabelString } from "./account-label";

export const GOOGLE_LINK_OAUTH_COOKIE = "meos_google_link_oauth";

export type GoogleLinkStatePayload = {
  v: 1;
  appUserId: string;
  state: string;
  codeVerifier: string;
  exp: number;
  /** Optional user label from ?label=; omitted in older cookies. */
  accountLabel?: string;
};

function signingSecret(): string {
  const s =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "";
  if (!s) {
    throw new Error(
      "AUTH_SECRET, NEXTAUTH_SECRET, or CLERK_SECRET_KEY is required for Google link OAuth state"
    );
  }
  return s;
}

export function createGoogleLinkStateCookieValue(
  payload: GoogleLinkStatePayload
): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", signingSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function parseGoogleLinkStateCookieValue(
  cookie: string | undefined | null
): GoogleLinkStatePayload | null {
  if (!cookie || typeof cookie !== "string") return null;
  const i = cookie.lastIndexOf(".");
  if (i <= 0) return null;
  const body = cookie.slice(0, i);
  const sig = cookie.slice(i + 1);
  const expected = createHmac("sha256", signingSecret())
    .update(body)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as GoogleLinkStatePayload;
    if (parsed.v !== 1) return null;
    if (
      typeof parsed.appUserId !== "string" ||
      typeof parsed.state !== "string" ||
      typeof parsed.codeVerifier !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    if (parsed.accountLabel !== undefined) {
      if (typeof parsed.accountLabel !== "string") return null;
      if (!isValidAccountLabelString(parsed.accountLabel)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
