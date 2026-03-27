"use client";

import { SignIn } from "@clerk/nextjs";

export function LoginClerkPanel({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="flex justify-center w-full">
      <SignIn
        routing="hash"
        signUpUrl="/sign-up"
        fallbackRedirectUrl={callbackUrl}
      />
    </div>
  );
}
