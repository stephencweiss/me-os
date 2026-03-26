export const MAIN_NAV_ITEMS = [
  { href: "/today", label: "Today", path: "/today" as const },
  { href: "/week?range=7", label: "Week", path: "/week" as const },
  { href: "/goals", label: "Goals", path: "/goals" as const },
] as const;
