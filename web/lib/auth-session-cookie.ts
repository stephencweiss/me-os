import "server-only";

import { getAuthDeploymentUrl } from "./auth-deployment-url";

/**
 * Database-session strategy: cookie value is the raw `next_auth.sessions.sessionToken`
 * (@auth/core session action sets `value: sessionToken` directly).
 */
export function formatDatabaseSessionSetCookieHeader(
  sessionToken: string,
  expires: Date
): string {
  const secure = getAuthDeploymentUrl().startsWith("https://");
  const name = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const parts = [
    `${name}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expires.toUTCString()}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
