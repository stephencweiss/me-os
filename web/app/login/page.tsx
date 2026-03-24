import { GoogleSignInShell } from "@/app/components/google-sign-in-shell";
import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    reason?: string;
  }>;
}) {
  const session = await auth();
  const params = await searchParams;

  // If already logged in, redirect to callback URL or home
  if (session?.user) {
    redirect(params.callbackUrl ?? "/");
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
            Sign in to access your calendar, goals, and time tracking
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

        <GoogleSignInShell
          callbackUrl={params.callbackUrl ?? "/"}
        >
          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: params.callbackUrl ?? "/",
              });
            }}
          >
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <GoogleIcon className="h-5 w-5" />
              </span>
              Sign in with Google
            </button>
          </form>
        </GoogleSignInShell>

        <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
          By signing in, you agree to connect your Google Calendar for time
          tracking and scheduling features.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
