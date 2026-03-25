/**
 * Local shape only — avoids importing `@capacitor/cli` types (not available to Next.js `tsc`).
 * `cap sync` reads this file at runtime; extend fields here if the CLI config grows.
 */
interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
  };
}

/**
 * Hosted Next.js: the native shell loads this URL (dev server or deployed site).
 * Run `pnpm dev` from `web/` before opening the iOS app in local dev.
 * Set CAP_SERVER_URL when pointing at staging/production.
 */
const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "com.stephencweiss.meos",
  appName: "MeOS",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http:"),
  },
};

export default config;
