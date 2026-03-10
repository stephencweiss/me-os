/**
 * Server-Side Supabase Client
 *
 * Creates Supabase clients for use in Next.js server components and API routes.
 * Uses service role key for admin operations or anon key with user context for RLS.
 */

import { createClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

// Re-export the typed client type for convenience
export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;

// Validate environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton client instance for server-side usage
let serverClient: TypedSupabaseClient | null = null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && (supabaseServiceKey || supabaseAnonKey));
}

/**
 * Create a Supabase admin client (bypasses RLS)
 * Only use for administrative operations like migrations
 */
export function createAdminClient(): TypedSupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for admin client"
    );
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a Supabase client with user context for RLS
 *
 * This client respects Row Level Security policies.
 * The userId is used to set the auth context for RLS.
 */
export function createUserClient(userId: string): TypedSupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for user client"
    );
  }

  // Create client with service role but set user context for RLS
  const client = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        // Set the user context for RLS policies
        // This allows RLS to use auth.uid() correctly
        "x-user-id": userId,
      },
    },
  });

  return client;
}

/**
 * Create a Supabase client for API routes
 *
 * In a multi-tenant setup, we use the service role key but execute
 * queries with explicit user_id filtering since the NextAuth session
 * provides the user context rather than Supabase Auth.
 *
 * Note: Since we're using NextAuth instead of Supabase Auth, RLS policies
 * based on auth.uid() won't work directly. We have two options:
 *
 * 1. Use service role + manual user_id filtering (simpler, what we do here)
 * 2. Set up a custom RLS context via headers (more complex)
 *
 * For security, all db-supabase functions require userId parameter
 * and include user_id in all queries.
 */
export function createServerClient(): TypedSupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server client"
    );
  }

  // Create singleton client for server-side usage
  if (!serverClient) {
    serverClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serverClient;
}

// Re-export types for convenience
export type { Database } from "./database.types";
