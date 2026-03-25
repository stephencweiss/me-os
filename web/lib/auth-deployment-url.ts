/**
 * Canonical site URL for Auth.js and OAuth redirect_uri (must match Google Console).
 */
export function getAuthDeploymentUrl(): string {
  let raw = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").trim();
  raw = raw.replace(/^["']|["']$/g, "");
  if (!raw) {
    throw new Error("AUTH_URL or NEXTAUTH_URL is required for OAuth");
  }
  const base = raw.replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(
      "AUTH_URL / NEXTAUTH_URL must be an absolute URL (e.g. http://localhost:3000)"
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      "AUTH_URL / NEXTAUTH_URL must use http: or https: (got " + parsed.protocol + ")"
    );
  }
  const path = parsed.pathname.replace(/\/$/, "") || "";
  return path ? `${parsed.origin}${path}` : parsed.origin;
}

export function getMobileGoogleOAuthCallbackUrl(): string {
  const base = getAuthDeploymentUrl();
  return new URL(
    "/api/auth/mobile/google/callback",
    `${base}/`
  ).toString();
}
