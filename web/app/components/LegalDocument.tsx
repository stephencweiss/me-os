import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocument({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur pt-safe px-4 py-4">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Sign in
          </Link>
          <nav className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
            <Link
              href="/privacy"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-gray-900 dark:hover:text-white"
            >
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10 pb-16">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: {lastUpdated}
        </p>
        <article className="space-y-6 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {children}
        </article>
      </main>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
