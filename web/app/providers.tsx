"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { CapacitorAuthBridge } from "@/app/components/capacitor-auth-bridge";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CapacitorAuthBridge />
      {children}
    </SessionProvider>
  );
}
