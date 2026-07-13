import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { BottomNav } from "@/components/shell/BottomNav";
import { ServiceWorkerRegistrar } from "@/components/shell/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "BidLens — Mac.bid Profitability Evaluator",
  description:
    "Upload one Mac.bid screenshot and get a defensible Strong Buy, Buy Below, Borderline, Pass, or Insufficient Evidence recommendation.",
  applicationName: "BidLens",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BidLens" },
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
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-4 lg:max-w-5xl">
          {children}
        </div>
        <BottomNav />
        <Toaster position="top-center" richColors closeButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
