"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CapacitorAuthBridge } from "@/app/components/capacitor-auth-bridge";
import { ClerkBootstrapSession } from "@/app/components/clerk-bootstrap-session";

export function Providers({
  children,
  clerkSignInUrl,
  clerkSignUpUrl,
}: {
  children: ReactNode;
  clerkSignInUrl: string;
  clerkSignUpUrl: string;
}) {
  return (
    <ClerkProvider signInUrl={clerkSignInUrl} signUpUrl={clerkSignUpUrl}>
      <ClerkBootstrapSession />
      <SessionProvider>
        <CapacitorAuthBridge />
        {children}
      </SessionProvider>
    </ClerkProvider>
  );
}
