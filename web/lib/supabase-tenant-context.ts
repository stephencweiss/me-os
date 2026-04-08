import { AsyncLocalStorage } from "node:async_hooks";
import type { TypedSupabaseClient } from "./supabase-server";

const tenantClientAls = new AsyncLocalStorage<TypedSupabaseClient>();

/**
 * Run `fn` with a Supabase client that enforces RLS (anon key + Clerk JWT).
 * Used for API handlers after `createSupabaseForClerkUser()`.
 */
export function runWithTenantSupabase<T>(
  client: TypedSupabaseClient,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return tenantClientAls.run(client, fn);
}

export function tryGetTenantSupabase(): TypedSupabaseClient | undefined {
  return tenantClientAls.getStore();
}
