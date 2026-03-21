import { auth } from "./auth";
import { NextResponse } from "next/server";

export type AuthResult =
  | { authorized: true; userId: string; email: string | null }
  | { authorized: false; response: NextResponse };

/**
 * Require authentication for an API route.
 *
 * Usage in API routes:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const authResult = await requireAuth();
 *   if (!authResult.authorized) return authResult.response;
 *
 *   const { userId } = authResult;
 *   // ... rest of handler
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    authorized: true,
    userId: session.user.id,
    email: session.user.email ?? null,
  };
}

/**
 * Get the current user's session without requiring authentication.
 * Returns null if not authenticated.
 */
export async function getOptionalAuth() {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

/**
 * Check if we're running in local mode (CLI/MCP) vs web mode.
 * In local mode, authentication is skipped.
 */
export function isLocalMode(): boolean {
  return (
    process.env.MEOS_MODE === "local" ||
    (!process.env.NEXTAUTH_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL)
  );
}

/**
 * Require authentication unless in local mode.
 * Useful for API routes that need to work both in web and CLI contexts.
 */
export async function requireAuthUnlessLocal(): Promise<
  AuthResult | { authorized: true; userId: null; email: null }
> {
  if (isLocalMode()) {
    return { authorized: true, userId: null, email: null };
  }
  return requireAuth();
}
