"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/habits", label: "Today" },
  { href: "/habits/trends", label: "Trends" },
  { href: "/habits/manage", label: "Manage" },
];

export function HabitsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Habits sections" className="grid grid-cols-3 rounded-lg bg-muted p-1">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md py-2 text-center text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
