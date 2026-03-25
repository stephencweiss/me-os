"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_ITEMS } from "@/lib/main-nav";

export default function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur pb-[max(0.25rem,env(safe-area-inset-bottom))]"
      aria-label="Primary"
    >
      <ul className="flex max-w-lg mx-auto">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = pathname === item.path;
          return (
            <li key={item.path} className="flex-1 min-w-0">
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 px-1 text-xs font-medium transition-colors ${
                  active
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <span className="truncate w-full text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
