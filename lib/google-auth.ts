import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { URL } from "url";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];
const CONFIG_DIR = path.join(process.cwd(), "config");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");
const TOKENS_PATH = path.join(CONFIG_DIR, "tokens.json");

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

function loadCredentials(): Credentials {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Credentials file not found at ${CREDENTIALS_PATH}.\n` +
        "Please download OAuth2 credentials from Google Cloud Console:\n" +
        "1. Go to https://console.cloud.google.com/apis/credentials\n" +
        "2. Create OAuth 2.0 Client ID (Desktop app)\n" +
        "3. Download JSON and save as config/credentials.json"
    );
  }
  const content = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
  return JSON.parse(content);
}

function loadTokens(): Tokens | null {
  if (!fs.existsSync(TOKENS_PATH)) {
    return null;
  }
  const content = fs.readFileSync(TOKENS_PATH, "utf-8");
  return JSON.parse(content);
}

function saveTokens(tokens: Tokens): void {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
  console.log("Tokens saved to", TOKENS_PATH);
}

function createOAuth2Client(credentials: Credentials): OAuth2Client {
  const config = credentials.installed || credentials.web;
  if (!config) {
    throw new Error("Invalid credentials format");
  }
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    config.redirect_uris[0]
  );
}

async function getNewTokens(oAuth2Client: OAuth2Client): Promise<Tokens> {
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
          const url = new URL(req.url, "http://localhost:3000");
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

    server.listen(3000, () => {
      console.log("Listening on http://localhost:3000 for OAuth callback...");
      // Open browser automatically on macOS
      import("child_process").then(({ exec }) => {
        exec(`open "${authUrl}"`);
      });
    });
  });
}

export async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const credentials = loadCredentials();
  const oAuth2Client = createOAuth2Client(credentials);

  let tokens = loadTokens();

  if (!tokens) {
    console.log("No tokens found, starting OAuth flow...");
    tokens = await getNewTokens(oAuth2Client);
    saveTokens(tokens);
  }

  oAuth2Client.setCredentials(tokens);

  // Check if token needs refresh
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    console.log("Token expired, refreshing...");
    const { credentials: newTokens } = await oAuth2Client.refreshAccessToken();
    saveTokens(newTokens as Tokens);
    oAuth2Client.setCredentials(newTokens);
  }

  return oAuth2Client;
}

export function getCalendarClient(auth: OAuth2Client) {
  return google.calendar({ version: "v3", auth });
}

// Run auth flow if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("Starting Google Calendar authentication...\n");
  getAuthenticatedClient()
    .then((client) => {
      console.log("\nAuthentication successful!");
      console.log("You can now use the calendar MCP server.");
    })
    .catch((err) => {
      console.error("Authentication failed:", err.message);
      process.exit(1);
    });
}
