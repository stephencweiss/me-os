/**
 * CRUD for linked_google_accounts with encrypted tokens.
 *
 * Rows are populated by mirroring OAuth tokens from `next_auth.accounts` (Auth.js adapter).
 * We avoid a NextAuth `signIn` callback so `lib/auth.ts` stays Edge-safe for middleware (no token-crypto in the bundle).
 */

import "server-only";
import { createServerClient, createNextAuthSchemaClient } from "./supabase-server";
import { encryptToken, decryptToken } from "./token-crypto";
import type { LinkedGoogleAccount, LinkedGoogleAccountInsert } from "./database.types";

/** Stable row id: next_auth user + Google subject (providerAccountId). */
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
    account_label: "primary",
    access_token: accessEnc,
    refresh_token: refreshEnc,
    token_expiry: tokenExpiry,
    scopes: params.scopes,
  };

  const supabase = createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("linked_google_accounts") as any).upsert(row, {
    onConflict: "id",
  });

  if (error) {
    throw new Error(`Failed to upsert linked Google account: ${error.message}`);
  }
}

/**
 * Copy Google tokens from Auth.js `next_auth.accounts` into `linked_google_accounts` (encrypted).
 * Best-effort: logs and returns on failure (e.g. schema not exposed, no Google account row yet).
 */
export async function mirrorLinkedGoogleFromNextAuthIfNeeded(userId: string): Promise<void> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  try {
    const na = createNextAuthSchemaClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (na.from("accounts") as any)
      .select("providerAccountId, access_token, refresh_token, expires_at, scope, users (email, name)")
      .eq("userId", userId)
      .eq("provider", "google")
      .maybeSingle();

    if (error) {
      console.warn("[linked-google] next_auth.accounts read failed:", error.message);
      return;
    }
    if (!data?.access_token || !data.providerAccountId) {
      return;
    }

    const u = data.users as { email: string | null; name: string | null } | null | undefined;
    const email = u?.email ?? "unknown@google";
    const scopes =
      typeof data.scope === "string" && data.scope.length > 0
        ? data.scope
        : "openid email profile https://www.googleapis.com/auth/calendar.readonly";

    await upsertEncryptedLinkedRow({
      userId,
      googleSubject: data.providerAccountId,
      googleEmail: email,
      displayName: u?.name ?? null,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAtSeconds: data.expires_at ?? null,
      scopes,
    });
  } catch (e) {
    console.error("[linked-google] mirror from next_auth failed:", e);
  }
}

export async function getLinkedAccountsForUser(userId: string): Promise<LinkedGoogleAccount[]> {
  await mirrorLinkedGoogleFromNextAuthIfNeeded(userId);

  const supabase = createServerClient();
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
  await mirrorLinkedGoogleFromNextAuthIfNeeded(userId);

  const supabase = createServerClient();
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

  const supabase = createServerClient();
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
