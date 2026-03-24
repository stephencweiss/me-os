/**
 * Custom URL scheme handoff into the Capacitor app (register same scheme in native project).
 */
export function buildMobileOAuthDeepLink(
  path: "complete" | "error",
  params: Record<string, string>
): string {
  const scheme = process.env.MOBILE_OAUTH_REDIRECT_SCHEME ?? "meos";
  const u = new URL(`${scheme}://auth/${path}`);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}
