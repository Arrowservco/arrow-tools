import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { HabitsTabs } from "@/features/HabitsTabs";
import { TodayDate } from "@/features/TodayDate";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Arrow Habits — Daily System Tracker",
  description:
    "Points-based daily habit tracker: check off the daily system, hit the goal, keep the streak.",
  applicationName: "Arrow Habits",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Arrow Habits" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14304f" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1524" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pb-10 pt-4">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
            <TodayDate />
          </header>
          <HabitsTabs />
          {children}
        </div>
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
