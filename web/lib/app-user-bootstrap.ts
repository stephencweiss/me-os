/**
 * Ensures `public.users` exists for a Clerk user and syncs `publicMetadata.app_user_id`
 * so session JWTs include the claim expected by Supabase RLS.
 */

import "server-only";

import { createClerkClient } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase-server";

const APP_USER_ID_META_KEY = "app_user_id";

export type BootstrapAppUserInput = {
  clerkUserId: string;
  email?: string | null;
  displayName?: string | null;
};

export function displayNameFromClerkWebhookUser(data: {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
}): string | null {
  const parts = [data.first_name, data.last_name].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  );
  if (parts.length > 0) return parts.join(" ");
  if (typeof data.username === "string" && data.username.trim().length > 0) {
    return data.username.trim();
  }
  return null;
}

export function primaryEmailFromClerkWebhookUser(data: {
  email_addresses?: { email_address?: string | null }[] | null;
}): string | null {
  const first = data.email_addresses?.[0]?.email_address;
  if (typeof first === "string" && first.trim().length > 0) return first.trim();
  return null;
}

function getClerkBackend() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not set");
  }
  return createClerkClient({ secretKey });
}

/**
 * Upsert `public.users` by `clerk_user_id`, then set Clerk `publicMetadata.app_user_id`.
 * Idempotent: skips Clerk update if metadata already matches.
 */
export async function bootstrapAppUserFromClerk(
  input: BootstrapAppUserInput
): Promise<{ appUserId: string }> {
  const { clerkUserId, email = null, displayName = null } = input;
  if (!clerkUserId) {
    throw new Error("bootstrapAppUserFromClerk: clerkUserId is required");
  }

  const supabase = createServerClient();

  const row = {
    clerk_user_id: clerkUserId,
    email,
    display_name: displayName,
  };

  const { data: upserted, error: upsertError } = await supabase
    .from("users")
    .upsert(row, { onConflict: "clerk_user_id" })
    .select("id")
    .single();

  if (upsertError || !upserted?.id) {
    throw new Error(
      `bootstrapAppUserFromClerk: Supabase upsert failed: ${upsertError?.message ?? "no row"}`
    );
  }

  const appUserId = upserted.id;

  const clerk = getClerkBackend();
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const meta = (clerkUser.publicMetadata ?? {}) as Record<string, unknown>;
  const existing = meta[APP_USER_ID_META_KEY];
  if (existing === appUserId) {
    return { appUserId };
  }

  await clerk.users.updateUser(clerkUserId, {
    publicMetadata: {
      ...meta,
      [APP_USER_ID_META_KEY]: appUserId,
    },
  });

  return { appUserId };
}

export async function deleteAppUserByClerkId(clerkUserId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from("users").delete().eq("clerk_user_id", clerkUserId);
  if (error) {
    throw new Error(`deleteAppUserByClerkId: ${error.message}`);
  }
}
