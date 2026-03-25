"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import BottomTabNav from "./BottomTabNav";
import PrimaryNav from "./PrimaryNav";
import { UserMenu } from "./UserMenu";

export default function MainAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur max-md:pt-safe-header md:pt-0">
        <div className="max-w-7xl mx-auto px-4 max-md:px-safe py-2 md:py-3 flex flex-wrap items-center justify-between gap-2 md:gap-3">
          <div className="hidden md:flex items-center gap-4 flex-1 min-w-0">
            <PrimaryNav />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-end md:justify-end flex-1 md:flex-none min-w-0">
            <Link
              href="/settings/accounts#calendar-sync"
              className="inline-flex items-center justify-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
            >
              Sync
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              Settings
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 max-md:px-safe pt-3 md:pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        {children}
      </main>

      <div className="md:hidden fixed bottom-0 inset-x-0 z-40">
        <BottomTabNav />
      </div>
    </div>
  );
}
