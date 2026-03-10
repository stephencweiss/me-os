import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { encrypt } from "@/lib/encryption";
import { upsertLinkedGoogleAccount } from "@/lib/db-supabase";

/**
 * Create OAuth2 client for Google Calendar linking
 */
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google Calendar OAuth configuration. Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * GET /api/google/callback
 *
 * OAuth callback handler. Google redirects here after user consent.
 * Exchanges the code for tokens and stores them in the database.
 *
 * Query params (from Google):
 *   - code: Authorization code
 *   - state: Base64-encoded JSON with { userId, label }
 *   - error: Error message if user denied consent
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Get the base URL for redirects
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  // Handle user denial
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(
      `${baseUrl}/settings/accounts?error=${encodeURIComponent("Google authorization was denied")}`
    );
  }

  // Validate required params
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/settings/accounts?error=${encodeURIComponent("Invalid OAuth callback - missing parameters")}`
    );
  }

  try {
    // Decode state to get userId and label
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId, label } = stateData;

    if (!userId || !label) {
      return NextResponse.redirect(
        `${baseUrl}/settings/accounts?error=${encodeURIComponent("Invalid OAuth state")}`
      );
    }

    // Exchange code for tokens
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new Error("No access token received from Google");
    }

    // Set credentials to make API calls
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    const googleEmail = userInfo.data.email;
    const googleUserId = userInfo.data.id;
    const displayName = userInfo.data.name;

    if (!googleEmail || !googleUserId) {
      throw new Error("Failed to get Google user info");
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Calculate token expiry
    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null;

    // Store in database
    await upsertLinkedGoogleAccount(userId, {
      googleEmail,
      googleUserId,
      displayName: displayName || null,
      accountLabel: label,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiry,
      scopes: tokens.scope || "",
    });

    // Redirect to success page
    return NextResponse.redirect(
      `${baseUrl}/settings/accounts?success=${encodeURIComponent(`Successfully linked ${googleEmail}`)}`
    );
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      `${baseUrl}/settings/accounts?error=${encodeURIComponent(`Failed to link account: ${message}`)}`
    );
  }
}
