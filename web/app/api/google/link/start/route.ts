import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  createGoogleLinkStateCookieValue,
  GOOGLE_LINK_OAUTH_COOKIE,
} from "@/lib/google-link-state-cookie";
import { buildWebGoogleLinkAuthorizationUrl } from "@/lib/google-web-link-oauth";
import { generateOAuthState, generatePkcePair } from "@/lib/mobile-google-oauth";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 15 * 60;

/**
 * GET /api/google/link/start — begin “connect Google Calendar” OAuth (Clerk session required).
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }

  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const payload = {
    v: 1 as const,
    appUserId: authResult.userId,
    state,
    codeVerifier,
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  };
  const cookieVal = createGoogleLinkStateCookieValue(payload);
  const googleUrl = buildWebGoogleLinkAuthorizationUrl({ state, codeChallenge });
  const res = NextResponse.redirect(googleUrl);
  res.cookies.set(GOOGLE_LINK_OAUTH_COOKIE, cookieVal, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
