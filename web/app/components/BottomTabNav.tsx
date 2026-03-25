"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MAIN_NAV_ITEMS } from "@/lib/main-nav";

function TabIconWrapper({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.25}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Compact calendar-day outline (24×24 viewBox). */
function IconToday() {
  return (
    <TabIconWrapper>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 2.75v3.5M16 2.75v3.5" />
    </TabIconWrapper>
  );
}

/** Three ascending bars — week / overview. */
function IconWeek() {
  return (
    <TabIconWrapper>
      <path d="M4 18v-5M12 18V8M20 18v-9" />
    </TabIconWrapper>
  );
}

/** Checklist — goals. */
function IconGoals() {
  return (
    <TabIconWrapper>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M5.5 6l1.25 1.25L9 4M5.5 12l1.25 1.25L9 10M5.5 18l1.25 1.25L9 16" />
    </TabIconWrapper>
  );
}

const TAB_ICONS: Record<(typeof MAIN_NAV_ITEMS)[number]["path"], ReactNode> = {
  "/today": <IconToday />,
  "/week": <IconWeek />,
  "/goals": <IconGoals />,
};

export default function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur pb-safe"
      aria-label="Primary"
    >
      <ul className="flex max-w-lg mx-auto">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <li key={item.path} className="flex-1 min-w-0">
              <Link
                href={item.href}
                className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {TAB_ICONS[item.path]}
                <span className="max-w-full truncate leading-tight">
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
