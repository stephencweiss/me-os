import "server-only";

import { createAdminClient } from "./supabase-server";
import type { Database } from "./database.types";

type ChallengeRow = Database["public"]["Tables"]["mobile_oauth_challenges"]["Row"];

const CHALLENGE_TTL_MS = 15 * 60 * 1000;
const PENDING_TTL_MS = 2 * 60 * 1000;

export async function purgeExpiredMobileOauthRows(): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  await admin.from("mobile_oauth_challenges").delete().lt("expires_at", now);
  await admin.from("mobile_oauth_pending").delete().lt("expires_at", now);
}

export async function insertMobileOauthChallenge(params: {
  state: string;
  codeVerifier: string;
  redirectTo: string;
}): Promise<void> {
  const admin = createAdminClient();
  const expires_at = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const { error } = await admin.from("mobile_oauth_challenges").insert({
    state: params.state,
    code_verifier: params.codeVerifier,
    redirect_to: params.redirectTo,
    expires_at,
  });
  if (error) throw new Error(`mobile_oauth_challenges insert: ${error.message}`);
}

export async function getMobileOauthChallenge(
  state: string
): Promise<ChallengeRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mobile_oauth_challenges")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (error) throw new Error(`mobile_oauth_challenges select: ${error.message}`);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await admin.from("mobile_oauth_challenges").delete().eq("state", state);
    return null;
  }
  return data;
}

export async function deleteMobileOauthChallenge(state: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("mobile_oauth_challenges").delete().eq("state", state);
}

export async function insertMobileOauthPending(params: {
  sessionToken: string;
  sessionExpiresAt: Date;
  redirectTo: string;
}): Promise<string> {
  const admin = createAdminClient();
  const expires_at = new Date(Date.now() + PENDING_TTL_MS).toISOString();
  const id = crypto.randomUUID();
  const { error } = await admin.from("mobile_oauth_pending").insert({
    id,
    session_token: params.sessionToken,
    session_expires_at: params.sessionExpiresAt.toISOString(),
    redirect_to: params.redirectTo,
    expires_at,
  });
  if (error) throw new Error(`mobile_oauth_pending insert: ${error.message}`);
  return id;
}

/** Single round-trip atomic consume: only unexpired rows return a token. */
export async function consumeMobileOauthPending(id: string): Promise<{
  session_token: string;
  session_expires_at: string;
  redirect_to: string | null;
} | null> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("mobile_oauth_pending")
    .delete()
    .eq("id", id)
    .gt("expires_at", nowIso)
    .select("session_token, session_expires_at, redirect_to")
    .maybeSingle();
  if (error) throw new Error(`mobile_oauth_pending consume: ${error.message}`);
  if (!data) return null;
  return {
    session_token: data.session_token,
    session_expires_at: data.session_expires_at,
    redirect_to: data.redirect_to,
  };
}
