"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import BottomTabNav from "./BottomTabNav";
import PrimaryNav from "./PrimaryNav";
import { UserMenu } from "./UserMenu";

export default function MainAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="hidden md:flex items-center gap-4 flex-1 min-w-0">
            <PrimaryNav />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto justify-end md:justify-end flex-1 md:flex-none">
            <Link
              href="/settings/accounts#calendar-sync"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
            >
              Sync
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              Settings
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 pt-4 pb-24 md:pb-8">
        {children}
      </main>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40">
        <BottomTabNav />
      </div>
    </div>
  );
}
