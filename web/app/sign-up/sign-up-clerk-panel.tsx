"use client";

import { SignUp } from "@clerk/nextjs";

export function SignUpClerkPanel({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="flex justify-center w-full">
      <SignUp
        routing="hash"
        signInUrl="/login"
        fallbackRedirectUrl={callbackUrl}
      />
    </div>
  );
}
