import { auth } from "@/lib/auth";
import { getBasePath, pathnameWithinBasePath } from "@/lib/base-path";
import { NextResponse } from "next/server";

// Must use the same `auth` as API routes (`lib/auth.ts`). A second `NextAuth(authConfig)` in
// proxy can pick a different session strategy (e.g. missing service-role env),
// which breaks session cookies with JWTSessionError / Invalid Compact JWE.

// Routes that don't require authentication
const publicRoutes = [
  "/login",
  "/privacy",
  "/terms",
  "/api/auth",
  "/api/health",
  // Clerk (NextAuth proxy does not see Clerk session; handlers enforce Clerk auth / Svix)
  "/api/webhooks/clerk",
  "/api/meos/ensure-user",
];

// Check if a path matches any public route (pathname includes `basePath` when set)
function isPublicRoute(pathname: string): boolean {
  const path = pathnameWithinBasePath(pathname);
  return publicRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Allow public routes
  if (isPublicRoute(nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals (pathname includes `basePath` when set)
  const relForAssets = pathnameWithinBasePath(nextUrl.pathname);
  if (
    relForAssets.startsWith("/_next") ||
    relForAssets.startsWith("/favicon") ||
    nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    const bp = getBasePath();
    const loginPath = bp ? `${bp}/login` : "/login";
    const loginUrl = new URL(loginPath, nextUrl.origin);
    const rel = pathnameWithinBasePath(nextUrl.pathname);
    const path = rel === "/" ? "/today" : rel;
    const callbackUrl = nextUrl.search ? `${path}${nextUrl.search}` : path;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
