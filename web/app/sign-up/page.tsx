import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignUpClerkPanel } from "@/app/sign-up/sign-up-clerk-panel";
import { safeRelativeRedirectPath } from "@/lib/safe-redirect-path";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
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
            Create your account
          </h2>
        </div>

        <SignUpClerkPanel callbackUrl={callbackUrl} />

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
