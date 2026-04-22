/**
 * NextAuth options shared by the app and Next.js proxy (formerly middleware).
 * Keep this file free of Node-only imports (no token-crypto / linked-google-accounts).
 */

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { resolveAuthRedirectUrl } from "./auth-redirect";
import { getAuthJsBasePath } from "./base-path";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Database sessions require URL + service role (proxy runs before routes — keep both in `.env.local`). */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

/**
 * Auth.js session signing secret. Required in production (e.g. Vercel); without it you get
 * `MissingSecret` — https://errors.authjs.dev#missingsecret
 * Generate: `openssl rand -base64 32`
 */
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;

export const authConfig: NextAuthConfig = {
  ...(authSecret ? { secret: authSecret } : {}),
  /** Must match real URL shape; do not rely on inferring from `AUTH_URL` pathname alone. */
  basePath: getAuthJsBasePath(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      /**
       * Web sign-in uses Auth.js cookie-backed OAuth (PKCE + state). Capacitor uses
       * `/api/auth/mobile/google/*` + system browser instead (server-stored PKCE/state).
       */
      checks: ["pkce", "state"],
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token?.sub ?? "";
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return resolveAuthRedirectUrl(url, baseUrl);
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
};

if (isSupabaseConfigured && supabaseUrl && supabaseServiceKey) {
  authConfig.adapter = SupabaseAdapter({
    url: supabaseUrl,
    secret: supabaseServiceKey,
  });
  authConfig.session = { strategy: "database" };
} else {
  authConfig.session = { strategy: "jwt" };
}
