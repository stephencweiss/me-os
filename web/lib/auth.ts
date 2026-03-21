import NextAuth, { type NextAuthConfig } from "next-auth";
import { authConfig } from "./auth.config";

/** Single NextAuth instance — import this `auth` from middleware and route handlers so session cookies stay consistent. */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig as NextAuthConfig);

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
