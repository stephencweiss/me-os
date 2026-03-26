/**
 * Subpath deployment (e.g. Hugo site rewrites `/app/me-os/*` → this Vercel app).
 * Set `NEXT_PUBLIC_BASE_PATH` to the same prefix (no trailing slash), e.g. `/app/me-os`.
 * Must match the rewrite destination path on Vercel (see README deployment section).
 */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

/**
 * Auth.js route prefix (matches `app/api/auth/[...nextauth]`). If unset, NextAuth
 * treats `AUTH_URL`'s pathname as `basePath`, which breaks subpath deploys:
 * OAuth `redirect_uri` becomes `{mount}/callback/google` instead of
 * `{mount}/api/auth/callback/google`.
 */
export function getAuthJsBasePath(): string {
  const bp = getBasePath();
  return bp ? `${bp}/api/auth` : "/api/auth";
}

/**
 * Middleware and incoming requests use the full pathname including `basePath`
 * (e.g. `/app/me-os/login`). App routes and `next/navigation` redirects expect
 * paths relative to `basePath` (e.g. `/login`).
 */
export function pathnameWithinBasePath(pathname: string): string {
  const base = getBasePath();
  if (!base) return pathname;
  if (pathname === base) return "/";
  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length);
  }
  return pathname;
}

/** Prefix an app-internal path for fetch() / href when basePath is not handled by Next.js. */
export function withBasePath(path: string): string {
  const base = getBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
