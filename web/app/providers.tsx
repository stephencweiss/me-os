"use client";

import { ClerkProvider } from "@clerk/nextjs";
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
      <CapacitorAuthBridge />
      {children}
    </ClerkProvider>
  );
}
