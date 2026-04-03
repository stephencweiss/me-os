/**
 * Canonical public URL of the Next app for OAuth (Google Calendar link flow).
 * Must match Google Cloud "Authorized redirect URIs" for `/api/google/link/callback`.
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

/** Web “connect Google Calendar” OAuth callback (Clerk session + PKCE cookie). */
export function getWebGoogleLinkCallbackUrl(): string {
  const base = getAuthDeploymentUrl().replace(/\/+$/, "");
  return `${base}/api/google/link/callback`;
}

/** Absolute URL for post-OAuth redirects (honors `AUTH_URL` / `NEXTAUTH_URL` path prefix). */
export function appAbsoluteUrl(
  pathname: string,
  searchParams?: Record<string, string>
): string {
  const base = getAuthDeploymentUrl().replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const q =
    searchParams && Object.keys(searchParams).length > 0
      ? `?${new URLSearchParams(searchParams).toString()}`
      : "";
  return `${base}${path}${q}`;
}
