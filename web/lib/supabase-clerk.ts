import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { TypedSupabaseClient } from "./supabase-server";

/**
 * Optional Clerk JWT template name (Dashboard → JWT Templates).
 * When unset, uses the default session token (must include `app_user_id` for RLS).
 */
function clerkJwtTemplate(): string | undefined {
  const t = process.env.CLERK_SUPABASE_JWT_TEMPLATE?.trim();
  return t && t.length > 0 ? t : undefined;
}

export type CreateClerkSupabaseResult =
  | { ok: true; client: TypedSupabaseClient }
  | { ok: false; reason: "no_clerk_user" | "no_jwt" | "missing_supabase_env" };

/**
 * Supabase client with **anon** key + Clerk session JWT in `Authorization`.
 * Postgres RLS uses `auth.jwt() ->> 'app_user_id'` (see migration 00007).
 */
export async function createSupabaseForClerkUser(): Promise<CreateClerkSupabaseResult> {
  const a = await auth();
  if (!a.userId) {
    return { ok: false, reason: "no_clerk_user" };
  }

  const template = clerkJwtTemplate();
  const token = template
    ? await a.getToken({ template })
    : await a.getToken();

  if (!token) {
    return { ok: false, reason: "no_jwt" };
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  if (!url || !anon) {
    return { ok: false, reason: "missing_supabase_env" };
  }

  const client = createClient<Database>(url, anon, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return { ok: true, client };
}
