import "server-only";

import { createHash, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import {
  getAuthDeploymentUrl,
  getMobileGoogleOAuthCallbackUrl,
} from "./auth-deployment-url";

export const GOOGLE_MOBILE_OAUTH_SCOPE =
  "openid email profile https://www.googleapis.com/auth/calendar.readonly";

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

/** RFC 7636: 43–128 char URL-safe verifier; 32 random bytes → base64url is 43 chars. */
export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildGoogleMobileAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not set");
  const redirectUri = getMobileGoogleOAuthCallbackUrl();
  const qp = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_MOBILE_OAUTH_SCOPE,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${qp.toString()}`;
}

export async function exchangeGoogleMobileAuthorizationCode(
  code: string,
  codeVerifier: string
) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET required");
  }
  const redirectUri = getMobileGoogleOAuthCallbackUrl();
  const client = new OAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await client.getToken({
    code,
    codeVerifier,
  });
  return tokens;
}

export type GoogleUserProfile = {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
};

export async function fetchGoogleUserProfile(
  accessToken: string
): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  const json = (await res.json()) as Partial<GoogleUserProfile>;
  if (!json.sub || !json.email) {
    throw new Error("Google userinfo missing sub/email");
  }
  return json as GoogleUserProfile;
}

/** Same redirect_uri string as authorize + token exchange + Google Console (no trailing slash drift). */
export function assertMobileOAuthRedirectUriConfigured(): void {
  getMobileGoogleOAuthCallbackUrl();
  getAuthDeploymentUrl();
}
