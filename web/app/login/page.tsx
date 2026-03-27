import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginClerkPanel } from "@/app/login/login-clerk-panel";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect-path";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    reason?: string;
  }>;
}) {
  const { userId } = await auth();
  const params = await searchParams;
  const callbackUrl = safeRelativeRedirectPath(params.callbackUrl, "/today");

  if (userId) {
    redirect(callbackUrl);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-4xl font-bold text-gray-900 dark:text-white">
            MeOS
          </h1>
          <h2 className="mt-2 text-center text-lg text-gray-600 dark:text-gray-400">
            Personal Operating System
          </h2>
          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Sign in with email to access your calendar, goals, and time tracking
          </p>
        </div>

        {params.error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">
              {params.error === "OAuthAccountNotLinked"
                ? "This email is already associated with another account."
                : params.error === "mobile_oauth"
                  ? params.reason
                    ? `Mobile sign-in: ${decodeURIComponent(params.reason)}`
                    : "Mobile sign-in failed. Try again."
                  : "An error occurred during sign in. Please try again."}
            </p>
          </div>
        )}

        <LoginClerkPanel callbackUrl={callbackUrl} />

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          Google Calendar is connected separately after sign-in (Settings → Linked
          Accounts).
        </p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          <Link
            href="/privacy"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          <span className="mx-2" aria-hidden>
            ·
          </span>
          <Link
            href="/terms"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline"
          >
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
