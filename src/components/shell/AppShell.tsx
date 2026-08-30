"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

const FULL_BLEED_PREFIXES = ["/storage-units"];

/**
 * Wraps route content in BidLens's centered mobile shell (padding + bottom nav) for every
 * route except full-bleed routes like the game, which need the entire viewport with no
 * chrome at all.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = FULL_BLEED_PREFIXES.some((p) => pathname.startsWith(p));

  if (fullBleed) {
    return <div className="fixed inset-0 h-dvh w-dvw">{children}</div>;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-24 pt-4 lg:max-w-5xl">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
