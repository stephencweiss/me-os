import { clerkMiddleware } from "@clerk/nextjs/server";
import { getBasePath, pathnameWithinBasePath } from "@/lib/base-path";
import { NextResponse } from "next/server";

const publicPrefixes = [
  "/login",
  "/sign-up",
  "/privacy",
  "/terms",
  "/api/auth",
  "/api/health",
  "/api/webhooks/clerk",
  "/api/meos/ensure-user",
] as const;

function isPublicRoute(pathname: string): boolean {
  const path = pathnameWithinBasePath(pathname);
  return publicPrefixes.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

function isStaticAsset(pathname: string): boolean {
  const rel = pathnameWithinBasePath(pathname);
  return (
    rel.startsWith("/_next") ||
    rel.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

const basePath = getBasePath();
const clerkSignInUrl = basePath ? `${basePath}/login` : "/login";
const clerkSignUpUrl = basePath ? `${basePath}/sign-up` : "/sign-up";

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;
    if (isPublicRoute(pathname) || isStaticAsset(pathname)) {
      return NextResponse.next();
    }
    await auth.protect();
  },
  {
    signInUrl: clerkSignInUrl,
    signUpUrl: clerkSignUpUrl,
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
