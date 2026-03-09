import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { google } from "googleapis";

/**
 * Google Calendar OAuth scopes
 */
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

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
 * GET /api/google/link
 *
 * Start the OAuth flow to link a Google Calendar account.
 * Returns a redirect URL that the frontend should navigate to.
 *
 * Query params:
 *   - label: Account label (e.g., "personal", "work") - required
 */
export async function GET(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  const searchParams = request.nextUrl.searchParams;
  const label = searchParams.get("label");

  if (!label) {
    return NextResponse.json(
      { error: "label query parameter is required (e.g., 'personal' or 'work')" },
      { status: 400 }
    );
  }

  try {
    const oauth2Client = createOAuth2Client();

    // Create state parameter to pass userId and label through OAuth flow
    const state = Buffer.from(
      JSON.stringify({ userId, label })
    ).toString("base64url");

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      state,
      // Force consent to always get a refresh token
      prompt: "consent",
      // Include granted scopes
      include_granted_scopes: true,
    });

    return NextResponse.json({
      authUrl,
      message: "Redirect user to authUrl to complete Google Calendar linking",
    });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    return NextResponse.json(
      { error: "Failed to start OAuth flow" },
      { status: 500 }
    );
  }
}
