import { NextRequest, NextResponse } from "next/server";
import { appAbsoluteUrl } from "@/lib/auth-deployment-url";
import { requireAuth } from "@/lib/auth-helpers";
import {
  GOOGLE_LINK_OAUTH_COOKIE,
  parseGoogleLinkStateCookieValue,
} from "@/lib/google-link-state-cookie";
import { upsertLinkedGoogleFromWebOAuth } from "@/lib/linked-google-accounts";
import { fetchGoogleUserProfile } from "@/lib/mobile-google-oauth";
import { exchangeWebGoogleLinkCode } from "@/lib/google-web-link-oauth";
import { withTenantSupabaseForApi } from "@/lib/with-tenant-supabase";

export const dynamic = "force-dynamic";

function clearLinkCookie(res: NextResponse) {
  res.cookies.set(GOOGLE_LINK_OAUTH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

function redirectAccounts(searchParams?: Record<string, string>) {
  return NextResponse.redirect(appAbsoluteUrl("/settings/accounts", searchParams));
}

/**
 * GET /api/google/link/callback — Google redirects here; Clerk session + signed cookie must match.
 */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    const res = redirectAccounts({ google_link: "auth" });
    clearLinkCookie(res);
    return res;
  }

  return withTenantSupabaseForApi(authResult, async ({ userId }) => {
  if (!userId) {
    const res = redirectAccounts({ google_link: "auth" });
    clearLinkCookie(res);
    return res;
  }

  const sp = request.nextUrl.searchParams;
  const oauthError = sp.get("error");
  if (oauthError) {
    const res = redirectAccounts({
      google_link: "denied",
      detail: oauthError.slice(0, 120),
    });
    clearLinkCookie(res);
    return res;
  }

  const code = sp.get("code");
  const state = sp.get("state");
  if (!code || !state) {
    const res = redirectAccounts({ google_link: "bad_request" });
    clearLinkCookie(res);
    return res;
  }

  const raw = request.cookies.get(GOOGLE_LINK_OAUTH_COOKIE)?.value;
  const payload = parseGoogleLinkStateCookieValue(raw);
  if (!payload || payload.state !== state) {
    const res = redirectAccounts({ google_link: "state" });
    clearLinkCookie(res);
    return res;
  }

  if (payload.appUserId !== userId) {
    const res = redirectAccounts({ google_link: "user_mismatch" });
    clearLinkCookie(res);
    return res;
  }

  try {
    const tokens = await exchangeWebGoogleLinkCode(code, payload.codeVerifier);
    const at = tokens.access_token;
    if (!at) {
      throw new Error("Google token response missing access_token");
    }
    const profile = await fetchGoogleUserProfile(at);
    await upsertLinkedGoogleFromWebOAuth({
      userId,
      tokens,
      profile,
      preferredAccountLabel: payload.accountLabel,
    });
    const res = redirectAccounts({ google_linked: "1" });
    clearLinkCookie(res);
    return res;
  } catch (e) {
    console.error("[google-link/callback]", e);
    const res = redirectAccounts({
      google_link: "exchange",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    });
    clearLinkCookie(res);
    return res;
  }
  });
}
