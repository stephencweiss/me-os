import { NextRequest, NextResponse } from "next/server";
import { parseAccountLabelQueryParam } from "@/lib/account-label";
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
 * Optional query: `label` — user-defined account label (max 64 chars, no control characters).
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }

  const labelResult = parseAccountLabelQueryParam(
    request.nextUrl.searchParams.get("label")
  );
  if (!labelResult.ok) {
    return NextResponse.json({ error: labelResult.message }, { status: 400 });
  }

  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const payload = {
    v: 1 as const,
    appUserId: authResult.userId,
    state,
    codeVerifier,
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
    ...(labelResult.value !== undefined
      ? { accountLabel: labelResult.value }
      : {}),
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
