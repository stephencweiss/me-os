import { NextRequest } from "next/server";
import { getBasePath } from "./base-path";

/**
 * Next.js strips `basePath` from `req.url` before App Router handlers run, so Auth.js
 * sees `/api/auth/...` while `authConfig.basePath` is `{basePath}/api/auth`. That
 * breaks `parseActionAndProviderId` and yields 400 "Bad request." on OAuth callback.
 */
export function authPathnameForAuthJs(
  pathname: string,
  nextBasePath: string
): string {
  if (!nextBasePath) return pathname;
  if (pathname.startsWith(`${nextBasePath}/`)) return pathname;
  if (pathname.startsWith("/api/auth")) {
    return `${nextBasePath}${pathname}`;
  }
  return pathname;
}

export function restoreAuthRequestUrlForAuthJs(req: NextRequest): NextRequest {
  const bp = getBasePath();
  const nextUrl = req.nextUrl.clone();
  const path = authPathnameForAuthJs(nextUrl.pathname, bp);
  if (path === nextUrl.pathname) return req;
  nextUrl.pathname = path;
  return new NextRequest(nextUrl, req);
}
