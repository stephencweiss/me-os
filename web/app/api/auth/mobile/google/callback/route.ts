import { NextRequest, NextResponse } from "next/server";
import { mirrorLinkedGoogleFromNextAuthIfNeeded } from "@/lib/linked-google-accounts";
import { buildMobileOAuthDeepLink } from "@/lib/mobile-oauth-deep-link";
import {
  exchangeGoogleMobileAuthorizationCode,
  fetchGoogleUserProfile,
} from "@/lib/mobile-google-oauth";
import {
  deleteMobileOauthChallenge,
  getMobileOauthChallenge,
  insertMobileOauthPending,
} from "@/lib/mobile-oauth-store";
import {
  createDatabaseSessionForGoogleUser,
  MobileOAuthAccountLinkError,
} from "@/lib/mobile-session-handoff";

export const dynamic = "force-dynamic";

function redirectToAppError(reason: string) {
  return NextResponse.redirect(
    buildMobileOAuthDeepLink("error", {
      reason: reason.slice(0, 240),
    })
  );
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const oerr = url.searchParams.get("error");
  if (oerr) {
    return redirectToAppError(oerr);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return redirectToAppError("missing_code_or_state");
  }

  const challenge = await getMobileOauthChallenge(state);
  if (!challenge) {
    return redirectToAppError("unknown_or_expired_state");
  }

  let tokens;
  try {
    tokens = await exchangeGoogleMobileAuthorizationCode(
      code,
      challenge.code_verifier
    );
  } catch {
    await deleteMobileOauthChallenge(state);
    return redirectToAppError("token_exchange_failed");
  }

  await deleteMobileOauthChallenge(state);

  const access = tokens.access_token;
  if (!access) {
    return redirectToAppError("no_access_token");
  }

  let profile;
  try {
    profile = await fetchGoogleUserProfile(access);
  } catch {
    return redirectToAppError("userinfo_failed");
  }

  let session: { sessionToken: string; expires: Date; userId: string };
  try {
    session = await createDatabaseSessionForGoogleUser({ profile, tokens });
  } catch (e) {
    if (e instanceof MobileOAuthAccountLinkError) {
      return redirectToAppError("OAuthAccountNotLinked");
    }
    throw e;
  }

  const redirectToStored = challenge.redirect_to?.trim() || "/";

  const pendingId = await insertMobileOauthPending({
    sessionToken: session.sessionToken,
    sessionExpiresAt: session.expires,
    redirectTo: redirectToStored,
  });

  void mirrorLinkedGoogleFromNextAuthIfNeeded(session.userId).catch(() => {});

  return NextResponse.redirect(
    buildMobileOAuthDeepLink("complete", { id: pendingId })
  );
}
