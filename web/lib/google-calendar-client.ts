/**
 * Google Calendar API client for webapp
 *
 * Handles updating event colors in Google Calendar.
 * Requires credentials and tokens files from the me-os config directory.
 *
 * Environment variables:
 *   GOOGLE_CREDENTIALS_DIR - Path to directory containing credentials-*.json and tokens-*.json
 */

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

// Get the credentials directory from environment or default to parent's config/sensitive
const CREDENTIALS_DIR =
  process.env.GOOGLE_CREDENTIALS_DIR ||
  path.join(process.cwd(), "..", "config", "sensitive");

interface Credentials {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface Tokens {
  access_token: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

// Map of email addresses to account names
// This mapping needs to match the credentials files available
let accountEmailMap: Record<string, string> | null = null;

/**
 * Build a map of email addresses to account names
 * This is done by reading the token files and checking the associated email
 */
async function getAccountEmailMap(): Promise<Record<string, string>> {
  if (accountEmailMap) return accountEmailMap;

  accountEmailMap = {};

  if (!fs.existsSync(CREDENTIALS_DIR)) {
    console.warn(`Google credentials directory not found: ${CREDENTIALS_DIR}`);
    return accountEmailMap;
  }

  const files = fs.readdirSync(CREDENTIALS_DIR);
  const accountNames = files
    .filter((f) => f.startsWith("tokens-") && f.endsWith(".json"))
    .map((f) => f.replace("tokens-", "").replace(".json", ""));

  for (const accountName of accountNames) {
    try {
      const client = await getAuthenticatedClient(accountName);
      const calendar = google.calendar({ version: "v3", auth: client });

      // Get the primary calendar to determine the account email
      const calList = await calendar.calendarList.get({ calendarId: "primary" });
      const email = calList.data.id;

      if (email) {
        accountEmailMap[email] = accountName;
      }
    } catch (err) {
      console.warn(`Failed to get email for account ${accountName}:`, err);
    }
  }

  return accountEmailMap;
}

/**
 * Get the account name from an email address
 */
async function getAccountNameFromEmail(email: string): Promise<string | null> {
  const emailMap = await getAccountEmailMap();
  return emailMap[email] || null;
}

function getCredentialsPath(account: string): string {
  return path.join(CREDENTIALS_DIR, `credentials-${account}.json`);
}

function getTokensPath(account: string): string {
  return path.join(CREDENTIALS_DIR, `tokens-${account}.json`);
}

function loadCredentials(account: string): Credentials {
  const credPath = getCredentialsPath(account);
  if (!fs.existsSync(credPath)) {
    throw new Error(`Credentials file not found at ${credPath}`);
  }
  const content = fs.readFileSync(credPath, "utf-8");
  return JSON.parse(content);
}

function loadTokens(account: string): Tokens | null {
  const tokensPath = getTokensPath(account);
  if (!fs.existsSync(tokensPath)) {
    return null;
  }
  const content = fs.readFileSync(tokensPath, "utf-8");
  return JSON.parse(content);
}

function saveTokens(tokens: Tokens, account: string): void {
  const tokensPath = getTokensPath(account);
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
}

function createOAuth2Client(credentials: Credentials): OAuth2Client {
  const config = credentials.installed || credentials.web;
  if (!config) {
    throw new Error("Invalid credentials format");
  }
  const redirectUri = config.redirect_uris[0];

  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    redirectUri
  );
}

async function getAuthenticatedClient(account: string): Promise<OAuth2Client> {
  const credentials = loadCredentials(account);
  const oAuth2Client = createOAuth2Client(credentials);

  const tokens = loadTokens(account);

  if (!tokens) {
    throw new Error(
      `No tokens found for account ${account}. Run auth flow first.`
    );
  }

  oAuth2Client.setCredentials(tokens);

  // Check if token needs refresh
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials: newTokens } = await oAuth2Client.refreshAccessToken();
      saveTokens(newTokens as Tokens, account);
      oAuth2Client.setCredentials(newTokens);
    } catch (err) {
      throw new Error(`Failed to refresh token for account ${account}: ${err}`);
    }
  }

  return oAuth2Client;
}

export interface UpdateColorResult {
  success: boolean;
  googleUpdated: boolean;
  error?: string;
  warning?: string;
}

/**
 * Update event color in Google Calendar
 *
 * @param googleEventId - The Google Calendar event ID
 * @param accountEmail - The email address of the account (from event.account)
 * @param colorId - The color ID (1-11)
 * @param calendarId - Optional calendar ID (defaults to "primary")
 */
export async function updateGoogleEventColor(
  googleEventId: string,
  accountOrEmail: string,
  colorId: string,
  calendarId: string = "primary"
): Promise<UpdateColorResult> {
  try {
    // Determine the account name
    // If this looks like an account name (credentials file exists), use it directly
    // Otherwise, try to look it up by email
    let accountName: string | null = null;

    const credentialsPath = path.join(CREDENTIALS_DIR, `credentials-${accountOrEmail}.json`);
    if (fs.existsSync(credentialsPath)) {
      // It's already an account name
      accountName = accountOrEmail;
    } else {
      // Try to look up by email
      accountName = await getAccountNameFromEmail(accountOrEmail);
    }

    if (!accountName) {
      return {
        success: true,
        googleUpdated: false,
        warning: `No Google credentials found for account ${accountOrEmail}. Local DB updated.`,
      };
    }

    const client = await getAuthenticatedClient(accountName);
    const calendar = google.calendar({ version: "v3", auth: client });

    await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: {
        colorId,
      },
    });

    return {
      success: true,
      googleUpdated: true,
    };
  } catch (err: any) {
    // Return success with warning if Google update fails
    // The local DB update already succeeded
    return {
      success: true,
      googleUpdated: false,
      warning: `Local DB updated but Google Calendar sync failed: ${err.message}`,
    };
  }
}

/**
 * Check if Google Calendar sync is configured
 */
export function isGoogleSyncConfigured(): boolean {
  return fs.existsSync(CREDENTIALS_DIR);
}
