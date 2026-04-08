import "server-only";

import { createHash, randomBytes } from "crypto";

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
