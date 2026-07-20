"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, History, ScanSearch, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Analyze", icon: ScanSearch },
  { href: "/history", label: "History", icon: History },
  { href: "/habits", label: "Habits", icon: Flame },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4 lg:max-w-5xl">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                active ? "text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
