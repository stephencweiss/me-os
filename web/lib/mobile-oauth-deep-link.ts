/** Strip accidental `:` / slashes so `.env` typos do not produce invalid URLs. */
export function normalizeMobileOAuthScheme(
  raw: string | undefined
): string {
  let s = (raw ?? "meos").trim().replace(/^["']|["']$/g, "");
  s = s.replace(/:$/, "").replace(/^\/+/, "");
  if (!s || !/^[a-z][a-z0-9+.-]*$/i.test(s)) {
    return "meos";
  }
  return s;
}

/**
 * Custom URL scheme handoff into the Capacitor app (register same scheme in native project).
 */
export function buildMobileOAuthDeepLink(
  path: "complete" | "error",
  params: Record<string, string>
): string {
  const scheme = normalizeMobileOAuthScheme(
    process.env.MOBILE_OAUTH_REDIRECT_SCHEME
  );
  const u = new URL(`${scheme}://auth/${path}`);
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}
