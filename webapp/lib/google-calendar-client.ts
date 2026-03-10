/**
 * Google Calendar API client for webapp
 *
 * Handles updating event colors in Google Calendar.
 * Supports two modes:
 *   1. Database mode (multi-tenant): Loads tokens from linked_google_accounts table
 *   2. File mode (local/CLI): Loads tokens from filesystem (legacy)
 *
 * Environment variables for DB mode:
 *   GOOGLE_CALENDAR_CLIENT_ID - OAuth client ID
 *   GOOGLE_CALENDAR_CLIENT_SECRET - OAuth client secret
 *   TOKEN_ENCRYPTION_KEY - Key for decrypting tokens
 *
 * Environment variables for file mode (legacy):
 *   GOOGLE_CREDENTIALS_DIR - Path to directory containing credentials-*.json and tokens-*.json
 */

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import { decrypt, encrypt, isEncryptionConfigured } from "./encryption";
import {
  getLinkedGoogleAccounts,
  getLinkedGoogleAccountByEmail,
  updateLinkedGoogleAccountTokens,
  type DbLinkedGoogleAccount,
} from "./db-supabase";

// ============================================================================
// Types
// ============================================================================

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

export interface UpdateColorResult {
  success: boolean;
  googleUpdated: boolean;
  error?: string;
  warning?: string;
}

// ============================================================================
// Database Mode (Multi-tenant)
// ============================================================================

/**
 * Create OAuth2 client for database mode
 */
function createDbOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CALENDAR_CLIENT_ID or GOOGLE_CALENDAR_CLIENT_SECRET"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret);
}

/**
 * Get an authenticated OAuth2 client from database tokens
 */
async function getDbAuthenticatedClient(
  userId: string,
  account: DbLinkedGoogleAccount
): Promise<OAuth2Client> {
  const oauth2Client = createDbOAuth2Client();

  // Decrypt tokens
  const accessToken = decrypt(account.access_token);
  const refreshToken = account.refresh_token
    ? decrypt(account.refresh_token)
    : undefined;

  // Set credentials
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.token_expiry
      ? new Date(account.token_expiry).getTime()
      : undefined,
  });

  // Check if token needs refresh
  const expiryTime = account.token_expiry
    ? new Date(account.token_expiry).getTime()
    : 0;
  const needsRefresh = expiryTime > 0 && expiryTime < Date.now();

  if (needsRefresh && refreshToken) {
    try {
      const { credentials: newTokens } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newTokens);

      // Update tokens in database
      const encryptedAccessToken = newTokens.access_token
        ? encrypt(newTokens.access_token)
        : account.access_token;
      const encryptedRefreshToken = newTokens.refresh_token
        ? encrypt(newTokens.refresh_token)
        : account.refresh_token;
      const tokenExpiry = newTokens.expiry_date
        ? new Date(newTokens.expiry_date).toISOString()
        : account.token_expiry;

      await updateLinkedGoogleAccountTokens(
        userId,
        account.id,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiry
      );
    } catch (err) {
      throw new Error(
        `Failed to refresh token for ${account.google_email}: ${err}`
      );
    }
  }

  return oauth2Client;
}

/**
 * Update event color using database tokens (multi-tenant mode)
 */
async function updateGoogleEventColorDb(
  userId: string,
  googleEventId: string,
  accountEmail: string,
  colorId: string,
  calendarId: string = "primary"
): Promise<UpdateColorResult> {
  try {
    // Find the linked account by email
    const account = await getLinkedGoogleAccountByEmail(userId, accountEmail);

    if (!account) {
      return {
        success: true,
        googleUpdated: false,
        warning: `No linked Google account found for ${accountEmail}. Local DB updated.`,
      };
    }

    const client = await getDbAuthenticatedClient(userId, account);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: true,
      googleUpdated: false,
      warning: `Local DB updated but Google Calendar sync failed: ${message}`,
    };
  }
}

// ============================================================================
// File Mode (Legacy/Local)
// ============================================================================

// Get the credentials directory from environment or default to parent's config/sensitive
const CREDENTIALS_DIR =
  process.env.GOOGLE_CREDENTIALS_DIR ||
  path.join(process.cwd(), "..", "config", "sensitive");

// Map of email addresses to account names (cached)
let accountEmailMap: Record<string, string> | null = null;

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

function createFileOAuth2Client(credentials: Credentials): OAuth2Client {
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

async function getFileAuthenticatedClient(account: string): Promise<OAuth2Client> {
  const credentials = loadCredentials(account);
  const oAuth2Client = createFileOAuth2Client(credentials);

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

/**
 * Build a map of email addresses to account names
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
      const client = await getFileAuthenticatedClient(accountName);
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

/**
 * Update event color using file-based tokens (legacy mode)
 */
async function updateGoogleEventColorFile(
  googleEventId: string,
  accountOrEmail: string,
  colorId: string,
  calendarId: string = "primary"
): Promise<UpdateColorResult> {
  try {
    // Determine the account name
    let accountName: string | null = null;

    const credentialsPath = path.join(
      CREDENTIALS_DIR,
      `credentials-${accountOrEmail}.json`
    );
    if (fs.existsSync(credentialsPath)) {
      accountName = accountOrEmail;
    } else {
      accountName = await getAccountNameFromEmail(accountOrEmail);
    }

    if (!accountName) {
      return {
        success: true,
        googleUpdated: false,
        warning: `No Google credentials found for account ${accountOrEmail}. Local DB updated.`,
      };
    }

    const client = await getFileAuthenticatedClient(accountName);
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: true,
      googleUpdated: false,
      warning: `Local DB updated but Google Calendar sync failed: ${message}`,
    };
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if database mode is configured (multi-tenant)
 */
export function isDbModeConfigured(): boolean {
  return (
    !!process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    isEncryptionConfigured()
  );
}

/**
 * Check if file mode is configured (legacy)
 */
export function isFileModeConfigured(): boolean {
  return fs.existsSync(CREDENTIALS_DIR);
}

/**
 * Check if Google Calendar sync is configured (either mode)
 */
export function isGoogleSyncConfigured(): boolean {
  return isDbModeConfigured() || isFileModeConfigured();
}

/**
 * Update event color in Google Calendar
 *
 * Automatically uses database mode if configured (multi-tenant),
 * otherwise falls back to file mode (legacy).
 *
 * @param googleEventId - The Google Calendar event ID
 * @param accountOrEmail - The email address of the account (from event.account)
 * @param colorId - The color ID (1-11)
 * @param calendarId - Optional calendar ID (defaults to "primary")
 * @param userId - Optional user ID for database mode
 */
export async function updateGoogleEventColor(
  googleEventId: string,
  accountOrEmail: string,
  colorId: string,
  calendarId: string = "primary",
  userId?: string
): Promise<UpdateColorResult> {
  // Use database mode if configured and userId is provided
  if (isDbModeConfigured() && userId) {
    return updateGoogleEventColorDb(
      userId,
      googleEventId,
      accountOrEmail,
      colorId,
      calendarId
    );
  }

  // Fall back to file mode
  if (isFileModeConfigured()) {
    return updateGoogleEventColorFile(
      googleEventId,
      accountOrEmail,
      colorId,
      calendarId
    );
  }

  // Neither mode configured
  return {
    success: true,
    googleUpdated: false,
    warning: "Google Calendar sync not configured. Local DB updated.",
  };
}

/**
 * Get linked accounts for a user (database mode only)
 */
export async function getLinkedAccountsForUser(
  userId: string
): Promise<Array<{ email: string; label: string }>> {
  if (!isDbModeConfigured()) {
    return [];
  }

  const accounts = await getLinkedGoogleAccounts(userId);
  return accounts.map((a) => ({
    email: a.google_email,
    label: a.account_label,
  }));
}
