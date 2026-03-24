/**
 * Canonical site URL for Auth.js and OAuth redirect_uri (must match Google Console).
 */
export function getAuthDeploymentUrl(): string {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!raw) {
    throw new Error("AUTH_URL or NEXTAUTH_URL is required for OAuth");
  }
  return raw.replace(/\/$/, "");
}

export function getMobileGoogleOAuthCallbackUrl(): string {
  const base = getAuthDeploymentUrl();
  return new URL(
    "/api/auth/mobile/google/callback",
    `${base}/`
  ).toString();
}
