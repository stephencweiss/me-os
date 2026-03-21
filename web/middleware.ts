import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Must use the same `auth` as API routes (`lib/auth.ts`). A second `NextAuth(authConfig)` in
// middleware can pick a different session strategy on Edge (e.g. missing service-role env),
// which breaks session cookies with JWTSessionError / Invalid Compact JWE.

// Routes that don't require authentication
const publicRoutes = ["/login", "/api/auth", "/api/health"];

// Check if a path matches any public route
function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Allow public routes
  if (isPublicRoute(nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    nextUrl.pathname.startsWith("/_next") ||
    nextUrl.pathname.startsWith("/favicon") ||
    nextUrl.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
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
