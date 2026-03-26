import { getBasePath } from "./base-path";

/**
 * Auth.js passes `baseUrl` as `url.origin` only (see `@auth/core` callback-url),
 * so relative redirects like `/today` become `https://example.com/today` and lose
 * `NEXT_PUBLIC_BASE_PATH`. This joins with `origin + basePath` when mounted.
 */
export function resolveAuthRedirectUrl(
  url: string,
  baseUrlFromAuthJs: string
): string {
  const origin = baseUrlFromAuthJs.replace(/\/$/, "");
  const bp = getBasePath();
  const appBase = bp ? `${origin}${bp}` : origin;

  if (url.startsWith("/")) {
    return `${appBase}${url}`;
  }
  try {
    const parsed = new URL(url);
    const originParsed = new URL(origin);
    if (parsed.origin !== originParsed.origin) {
      return appBase;
    }
    if (
      bp &&
      parsed.pathname !== bp &&
      !parsed.pathname.startsWith(`${bp}/`)
    ) {
      return `${appBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return url;
  } catch {
    return appBase;
  }
}
