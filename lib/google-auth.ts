import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { URL } from "url";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const CONFIG_DIR = path.join(process.cwd(), "config");

// Default account can be overridden via GOOGLE_ACCOUNT env var
const DEFAULT_ACCOUNT = process.env.GOOGLE_ACCOUNT || "personal";

function getCredentialsPath(account: string): string {
  return path.join(CONFIG_DIR, `credentials-${account}.json`);
}

function getTokensPath(account: string): string {
  return path.join(CONFIG_DIR, `tokens-${account}.json`);
}

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

function loadCredentials(account: string): Credentials {
  const credPath = getCredentialsPath(account);
  if (!fs.existsSync(credPath)) {
    throw new Error(
      `Credentials file not found at ${credPath}.\n` +
        "Please download OAuth2 credentials from Google Cloud Console:\n" +
        "1. Go to https://console.cloud.google.com/apis/credentials\n" +
        "2. Create OAuth 2.0 Client ID (Desktop app)\n" +
        `3. Download JSON and save as config/credentials-${account}.json`
    );
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
  console.log("Tokens saved to", tokensPath);
}

interface OAuth2Config {
  client: OAuth2Client;
  redirectUri: string;
  port: number;
}

function createOAuth2Client(credentials: Credentials): OAuth2Config {
  const config = credentials.installed || credentials.web;
  if (!config) {
    throw new Error("Invalid credentials format");
  }
  const redirectUri = config.redirect_uris[0];
  const url = new URL(redirectUri);
  const port = url.port ? parseInt(url.port) : 80;

  return {
    client: new google.auth.OAuth2(
      config.client_id,
      config.client_secret,
      redirectUri
    ),
    redirectUri,
    port,
  };
}

async function getNewTokens(oAuth2Client: OAuth2Client, port: number): Promise<Tokens> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\nAuthorize this app by visiting this URL:\n");
  console.log(authUrl);
  console.log("\nWaiting for authorization...\n");

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.startsWith("/oauth2callback") || req.url?.startsWith("/?")) {
          const url = new URL(req.url, `http://localhost:${port}`);
          const code = url.searchParams.get("code");

          if (!code) {
            res.writeHead(400);
            res.end("No authorization code received");
            reject(new Error("No authorization code"));
            return;
          }

          const { tokens } = await oAuth2Client.getToken(code);

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<h1>Authorization successful!</h1><p>You can close this window.</p>"
          );

          server.close();
          resolve(tokens as Tokens);
        }
      } catch (err) {
        res.writeHead(500);
        res.end("Authorization failed");
        reject(err);
      }
    });

    server.listen(port, () => {
      console.log(`Listening on http://localhost:${port} for OAuth callback...`);
      // Open browser automatically on macOS
      import("child_process").then(({ exec }) => {
        exec(`open "${authUrl}"`);
      });
    });
  });
}

export async function getAuthenticatedClient(account: string = DEFAULT_ACCOUNT): Promise<OAuth2Client> {
  console.log(`Using Google account: ${account}`);
  const credentials = loadCredentials(account);
  const { client: oAuth2Client, port } = createOAuth2Client(credentials);

  let tokens = loadTokens(account);

  if (!tokens) {
    console.log("No tokens found, starting OAuth flow...");
    tokens = await getNewTokens(oAuth2Client, port);
    saveTokens(tokens, account);
  }

  oAuth2Client.setCredentials(tokens);

  // Check if token needs refresh
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    console.log("Token expired, refreshing...");
    const { credentials: newTokens } = await oAuth2Client.refreshAccessToken();
    saveTokens(newTokens as Tokens, account);
    oAuth2Client.setCredentials(newTokens);
  }

  return oAuth2Client;
}

export function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

// List available accounts (have credentials)
export function listAvailableAccounts(): string[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(f => f.startsWith("credentials-") && f.endsWith(".json"))
    .map(f => f.replace("credentials-", "").replace(".json", ""));
}

// List authenticated accounts (have tokens)
export function listAuthenticatedAccounts(): string[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs.readdirSync(CONFIG_DIR)
    .filter(f => f.startsWith("tokens-") && f.endsWith(".json"))
    .map(f => f.replace("tokens-", "").replace(".json", ""));
}

// Get all authenticated clients for multi-account views
export interface AuthenticatedAccount {
  account: string;
  client: OAuth2Client;
  calendar: ReturnType<typeof google.calendar>;
}

export async function getAllAuthenticatedClients(): Promise<AuthenticatedAccount[]> {
  const accounts = listAuthenticatedAccounts();
  const clients: AuthenticatedAccount[] = [];

  for (const account of accounts) {
    try {
      const client = await getAuthenticatedClient(account);
      const calendar = getCalendarClient(client);
      clients.push({ account, client, calendar });
    } catch (err) {
      console.error(`Failed to load account ${account}:`, err);
      // Continue with other accounts
    }
  }

  return clients;
}

// Run auth flow if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const account = process.argv[2] || DEFAULT_ACCOUNT;

  if (process.argv[2] === "--list") {
    const accounts = listAvailableAccounts();
    console.log("Available accounts:");
    accounts.forEach(a => console.log(`  - ${a}`));
    if (accounts.length === 0) {
      console.log("  (none found - add credentials-<name>.json to config/)");
    }
    process.exit(0);
  }

  console.log(`Starting Google Calendar authentication for account: ${account}\n`);
  console.log("Usage: npm run auth [account-name]");
  console.log("       npm run auth --list\n");

  getAuthenticatedClient(account)
    .then((client) => {
      console.log("\nAuthentication successful!");
      console.log("You can now use the calendar MCP server.");
    })
    .catch((err) => {
      console.error("Authentication failed:", err.message);
      process.exit(1);
    });
}
