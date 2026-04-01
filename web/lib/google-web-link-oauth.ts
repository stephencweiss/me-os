import "server-only";

import { OAuth2Client } from "google-auth-library";
import { getWebGoogleLinkCallbackUrl } from "./auth-deployment-url";
import { GOOGLE_MOBILE_OAUTH_SCOPE } from "./mobile-google-oauth";

/** Same scopes as mobile / legacy NextAuth Google (Calendar read-only + OIDC profile). */
export const GOOGLE_WEB_LINK_SCOPE = GOOGLE_MOBILE_OAUTH_SCOPE;

export function buildWebGoogleLinkAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const redirectUri = getWebGoogleLinkCallbackUrl();
  const qp = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_WEB_LINK_SCOPE,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${qp.toString()}`;
}

export async function exchangeWebGoogleLinkCode(
  code: string,
  codeVerifier: string
) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET required");
  }
  const redirectUri = getWebGoogleLinkCallbackUrl();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken({
    code,
    codeVerifier,
  });
  return tokens;
}
