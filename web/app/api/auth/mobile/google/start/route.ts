import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth.config";
import {
  assertMobileOAuthRedirectUriConfigured,
  buildGoogleMobileAuthorizationUrl,
  generateOAuthState,
  generatePkcePair,
} from "@/lib/mobile-google-oauth";
import {
  insertMobileOauthChallenge,
  purgeExpiredMobileOauthRows,
} from "@/lib/mobile-oauth-store";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect-path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      {
        error:
          "Mobile system-browser sign-in requires database sessions (Supabase + NextAuth adapter).",
      },
      { status: 501 }
    );
  }

  try {
    assertMobileOAuthRedirectUriConfigured();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Auth URL misconfigured";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let body: { callbackUrl?: string } = {};
  try {
    body = (await req.json()) as { callbackUrl?: string };
  } catch {
    body = {};
  }

  const redirectTo = safeRelativeRedirectPath(body.callbackUrl, "/");

  await purgeExpiredMobileOauthRows().catch(() => {});

  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();

  try {
    await insertMobileOauthChallenge({ state, codeVerifier, redirectTo });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to start OAuth";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const url = buildGoogleMobileAuthorizationUrl({ state, codeChallenge });
  return NextResponse.json({ url });
}
