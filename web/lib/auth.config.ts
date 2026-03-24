/**
 * NextAuth options shared by the app and Edge middleware.
 * Keep this file free of Node-only imports (no token-crypto / linked-google-accounts).
 */

import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
/** Database sessions require URL + service role (middleware runs on Edge — keep both in `.env.local`). */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      /**
       * Default Auth.js OAuth checks include PKCE, which stores `pkceCodeVerifier` in a cookie.
       * iOS WKWebView (Capacitor) often drops that cookie on the redirect back from Google,
       * causing InvalidCheck / pkceCodeVerifier parse errors. We use a confidential client
       * (client secret) so PKCE is optional; `state` still protects the CSRF surface.
       */
      checks: ["state"],
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
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
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
