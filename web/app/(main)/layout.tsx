import type { ReactNode } from "react";
import MainAppShell from "../components/MainAppShell";

export default function MainLayout({ children }: { children: ReactNode }) {
  return <MainAppShell>{children}</MainAppShell>;
}
