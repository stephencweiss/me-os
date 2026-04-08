import "server-only";

import { auth as clerkAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseForClerkUser } from "./supabase-clerk";
import { runWithTenantSupabase } from "./supabase-tenant-context";

type UnlessLocalOk = { authorized: true; userId: null; email: null };
type UnlessLocalAuthed = { authorized: true; userId: string; email: string | null };
type UnlessLocalFail = { authorized: false; response: NextResponse };

export type RequireAuthUnlessLocalResult =
  | UnlessLocalOk
  | UnlessLocalAuthed
  | UnlessLocalFail;

type RequireAuthOk = { authorized: true; userId: string; email: string | null };
type RequireAuthFail = { authorized: false; response: NextResponse };

export type RequireAuthResult = RequireAuthOk | RequireAuthFail;

export type TenantApiAuthContext = {
  userId: string | null;
  email: string | null;
};

/**
 * For authenticated API handlers: use Clerk JWT + anon Supabase when the user is a Clerk session;
 * otherwise (local mode or non-Clerk session) keep the service-role path via ALS unset.
 */
export async function withTenantSupabaseForApi<T>(
  authResult: RequireAuthUnlessLocalResult | RequireAuthResult,
  fn: (ctx: TenantApiAuthContext) => Promise<T>
): Promise<T | NextResponse> {
  if (!authResult.authorized) {
    return authResult.response;
  }

  const ctx: TenantApiAuthContext = {
    userId: authResult.userId,
    email: authResult.email,
  };

  if (authResult.userId === null) {
    return fn(ctx);
  }

  const c = await clerkAuth();
  if (c.userId) {
    const sup = await createSupabaseForClerkUser();
    if (!sup.ok) {
      const message =
        sup.reason === "no_jwt"
          ? "Missing Clerk JWT for Supabase (add app_user_id to session or set CLERK_SUPABASE_JWT_TEMPLATE)."
          : sup.reason === "missing_supabase_env"
            ? "Supabase URL or anon key is not configured."
            : "Could not open Supabase session for this request.";
      return NextResponse.json(
        { error: message, code: `supabase_${sup.reason}` },
        { status: 401 }
      );
    }
    return runWithTenantSupabase(sup.client, () => fn(ctx));
  }

  return fn(ctx);
}
