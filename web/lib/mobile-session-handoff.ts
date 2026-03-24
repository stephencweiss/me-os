import "server-only";

import { randomBytes } from "crypto";
import type { Credentials } from "google-auth-library";
import { createNextAuthSchemaClient } from "./supabase-server";
import type { GoogleUserProfile } from "./mobile-google-oauth";
import { GOOGLE_MOBILE_OAUTH_SCOPE } from "./mobile-google-oauth";

/** Align with Auth.js default session maxAge when unset (30 days). */
export const DATABASE_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export class MobileOAuthAccountLinkError extends Error {
  constructor() {
    super("OAuthAccountNotLinked");
    this.name = "MobileOAuthAccountLinkError";
  }
}

/**
 * Upsert next_auth user + Google account and create a new DB session row.
 */
export async function createDatabaseSessionForGoogleUser(params: {
  profile: GoogleUserProfile;
  tokens: Credentials;
}): Promise<{ sessionToken: string; expires: Date; userId: string }> {
  const na = createNextAuthSchemaClient();
  const { profile, tokens } = params;
  const accessToken = tokens.access_token;
  if (!accessToken) throw new Error("Google tokens missing access_token");

  const { data: existingAcct } = await na
    .from("accounts")
    .select("userId")
    .eq("provider", "google")
    .eq("providerAccountId", profile.sub)
    .maybeSingle();

  const { data: emailUser } = await na
    .from("users")
    .select("id")
    .eq("email", profile.email)
    .maybeSingle();

  let userId: string;

  if (emailUser?.id) {
    userId = emailUser.id;
    if (existingAcct?.userId && existingAcct.userId !== userId) {
      throw new MobileOAuthAccountLinkError();
    }
  } else if (existingAcct?.userId) {
    userId = existingAcct.userId;
  } else {
    const newId = crypto.randomUUID();
    const { error: insErr } = await na.from("users").insert({
      id: newId,
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0]!,
      image: profile.picture ?? null,
      emailVerified: new Date().toISOString(),
    });
    if (insErr) throw new Error(`next_auth.users insert: ${insErr.message}`);
    userId = newId;
  }

  const expiresAtMs =
    tokens.expiry_date != null
      ? tokens.expiry_date
      : Date.now() + 3600 * 1000;
  const expires_at_sec = Math.floor(expiresAtMs / 1000);

  const { error: accErr } = await na.from("accounts").upsert(
    {
      userId,
      type: "oauth",
      provider: "google",
      providerAccountId: profile.sub,
      refresh_token: tokens.refresh_token ?? null,
      access_token: tokens.access_token ?? null,
      expires_at: expires_at_sec,
      token_type: "Bearer",
      scope: tokens.scope ?? GOOGLE_MOBILE_OAUTH_SCOPE,
      id_token: tokens.id_token ?? null,
    },
    { onConflict: "provider,providerAccountId" }
  );
  if (accErr) throw new Error(`next_auth.accounts upsert: ${accErr.message}`);

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DATABASE_SESSION_MAX_AGE_SEC * 1000);

  const { error: sessErr } = await na.from("sessions").insert({
    sessionToken,
    userId,
    expires: expires.toISOString(),
  });
  if (sessErr) throw new Error(`next_auth.sessions insert: ${sessErr.message}`);

  return { sessionToken, expires, userId };
}
