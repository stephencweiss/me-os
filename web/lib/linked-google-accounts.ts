/**
 * CRUD for linked_google_accounts with encrypted tokens.
 *
 * Rows are created by `/api/google/link/*` (Clerk session + Google OAuth).
 */

import "server-only";
import type { Credentials } from "google-auth-library";
import { createServerClient, getTenantSupabaseOrServiceRole } from "./supabase-server";
import { encryptToken, decryptToken } from "./token-crypto";
import type { LinkedGoogleAccount, LinkedGoogleAccountInsert } from "./database.types";
import { GOOGLE_MOBILE_OAUTH_SCOPE } from "./mobile-google-oauth";
import type { GoogleUserProfile } from "./mobile-google-oauth";

/** Stable row id: MeOS tenant user id + Google subject (`sub`). */
export function makeLinkedGoogleAccountId(userId: string, googleSubject: string): string {
  return `${userId}:${googleSubject}`;
}

async function upsertEncryptedLinkedRow(params: {
  userId: string;
  googleSubject: string;
  googleEmail: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAtSeconds: number | null;
  scopes: string;
  accountLabel?: string;
}): Promise<void> {
  const id = makeLinkedGoogleAccountId(params.userId, params.googleSubject);
  const accessEnc = encryptToken(params.accessToken);
  const refreshEnc = params.refreshToken ? encryptToken(params.refreshToken) : null;

  const tokenExpiry =
    params.expiresAtSeconds != null
      ? new Date(params.expiresAtSeconds * 1000).toISOString()
      : null;

  const row: LinkedGoogleAccountInsert = {
    id,
    user_id: params.userId,
    google_email: params.googleEmail,
    google_user_id: params.googleSubject,
    display_name: params.displayName,
    account_label: params.accountLabel ?? "primary",
    access_token: accessEnc,
    refresh_token: refreshEnc,
    token_expiry: tokenExpiry,
    scopes: params.scopes,
  };

  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("linked_google_accounts") as any).upsert(row, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Failed to upsert linked Google account: ${error.message}`);
  }
}

/** Persist tokens from web “Connect Google Calendar” OAuth (Clerk `public.users.id` as `user_id`). */
export async function upsertLinkedGoogleFromWebOAuth(params: {
  userId: string;
  tokens: Credentials;
  profile: GoogleUserProfile;
}): Promise<void> {
  const access = params.tokens.access_token;
  if (!access) {
    throw new Error("upsertLinkedGoogleFromWebOAuth: missing access_token");
  }
  const expSeconds =
    params.tokens.expiry_date != null
      ? Math.floor(params.tokens.expiry_date / 1000)
      : null;
  await upsertEncryptedLinkedRow({
    userId: params.userId,
    googleSubject: params.profile.sub,
    googleEmail: params.profile.email,
    displayName: params.profile.name ?? null,
    accessToken: access,
    refreshToken: params.tokens.refresh_token ?? null,
    expiresAtSeconds: expSeconds,
    scopes: GOOGLE_MOBILE_OAUTH_SCOPE,
    accountLabel: "calendar",
  });
}

export async function getLinkedAccountsForUser(userId: string): Promise<LinkedGoogleAccount[]> {
  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("linked_google_accounts") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load linked Google accounts: ${error.message}`);
  }
  return (data || []) as LinkedGoogleAccount[];
}

export async function getLinkedAccountById(
  userId: string,
  id: string
): Promise<LinkedGoogleAccount | null> {
  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("linked_google_accounts") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load linked account: ${error.message}`);
  }
  return data as LinkedGoogleAccount | null;
}

export async function deleteLinkedGoogleAccountForUser(
  userId: string,
  id: string
): Promise<void> {
  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("linked_google_accounts") as any)
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete linked Google account: ${error.message}`);
  }
}

export type DecryptedLinkedAccount = LinkedGoogleAccount & {
  accessTokenPlain: string;
  refreshTokenPlain: string | null;
};

export function decryptLinkedAccountTokens(row: LinkedGoogleAccount): DecryptedLinkedAccount {
  return {
    ...row,
    accessTokenPlain: decryptToken(row.access_token),
    refreshTokenPlain: row.refresh_token ? decryptToken(row.refresh_token) : null,
  };
}

export async function updateLinkedAccountTokens(
  userId: string,
  id: string,
  tokens: { access_token: string; refresh_token?: string | null; expires_at?: number | null }
): Promise<void> {
  const accessEnc = encryptToken(tokens.access_token);
  const refreshEnc =
    tokens.refresh_token != null && tokens.refresh_token !== ""
      ? encryptToken(tokens.refresh_token)
      : undefined;

  const tokenExpiry =
    tokens.expires_at != null ? new Date(tokens.expires_at * 1000).toISOString() : null;

  const supabase = getTenantSupabaseOrServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("linked_google_accounts") as any)
    .update({
      access_token: accessEnc,
      ...(refreshEnc !== undefined ? { refresh_token: refreshEnc } : {}),
      token_expiry: tokenExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update linked account tokens: ${error.message}`);
  }
}
