/**
 * Origin for browser/Capacitor fetches to the Next app. When the WebView URL is not the
 * API host (e.g. `capacitor://localhost`), set `NEXT_PUBLIC_APP_ORIGIN` to match `AUTH_URL`
 * (e.g. `http://localhost:3000` or your LAN IP for a device).
 */
export function getClientAppOrigin(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_APP_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return window.location.origin;
}
