import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const APP_USER_META_KEY = "app_user_id";

export type AuthResult =
  | { authorized: true; userId: string; email: string | null }
  | { authorized: false; response: NextResponse };

function appUserIdFromPublicMetadata(
  meta: Record<string, unknown> | undefined
): string | null {
  if (!meta) return null;
  const v = meta[APP_USER_META_KEY];
  return typeof v === "string" && v.length > 0 ? v : null;
}

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
  const clerk = await clerkAuth();
  if (!clerk.userId) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const user = await currentUser();
  const appUserId = appUserIdFromPublicMetadata(
    user?.publicMetadata as Record<string, unknown> | undefined
  );
  if (!appUserId) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "CLERK_APP_USER_PENDING" },
        { status: 401 }
      ),
    };
  }

  return {
    authorized: true,
    userId: appUserId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
  };
}

/**
 * Get the current user's session without requiring authentication.
 * Returns null if not authenticated.
 */
export async function getOptionalAuth() {
  const clerk = await clerkAuth();
  if (!clerk.userId) {
    return null;
  }

  const user = await currentUser();
  const appUserId = appUserIdFromPublicMetadata(
    user?.publicMetadata as Record<string, unknown> | undefined
  );
  if (!appUserId) return null;

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    null;

  return {
    userId: appUserId,
    email: user?.primaryEmailAddress?.emailAddress ?? null,
    name,
    image: user?.imageUrl ?? null,
  };
}

/**
 * Check if we're running in local mode (CLI/MCP) vs web mode.
 * In local mode, authentication is skipped.
 */
export function isLocalMode(): boolean {
  return (
    process.env.MEOS_MODE === "local" ||
    (!process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
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
