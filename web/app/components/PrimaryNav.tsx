"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV_ITEMS } from "@/lib/main-nav";

export default function PrimaryNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      {MAIN_NAV_ITEMS.map((item) => {
        const active = pathname === item.path;
        return (
          <Link
            key={item.path}
            href={item.href}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              active
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
