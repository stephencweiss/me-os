import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getBasePath } from "@/lib/base-path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeOS - Personal Operating System",
  description: "Calendar, goals, and time tracking dashboard",
};

/** Lets `env(safe-area-inset-*)` resolve under the notch / home indicator (Capacitor + Safari). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const bp = getBasePath();
  const clerkSignInUrl = bp ? `${bp}/login` : "/login";
  const clerkSignUpUrl = bp ? `${bp}/sign-up` : "/sign-up";

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers
          clerkSignInUrl={clerkSignInUrl}
          clerkSignUpUrl={clerkSignUpUrl}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
