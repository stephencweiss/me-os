/**
 * Subpath deployment (e.g. Hugo site rewrites `/app/me-os/*` → this Vercel app).
 * Set `NEXT_PUBLIC_BASE_PATH` to the same prefix (no trailing slash), e.g. `/app/me-os`.
 * Must match the rewrite destination path on Vercel (see README deployment section).
 */
export function getBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
  return raw.replace(/\/$/, "");
}

/** Prefix an app-internal path for fetch() / href when basePath is not handled by Next.js. */
export function withBasePath(path: string): string {
  const base = getBasePath();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!base) return p;
  return `${base}${p}`;
}
