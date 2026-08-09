"use client";

import { useState } from "react";
import { dateKeyLabel, localDateKey } from "@/lib/habits/scoring";

/** Client-only so the date reflects the viewer's clock, not the build's. */
export function TodayDate() {
  const [label] = useState(() =>
    typeof window === "undefined"
      ? ""
      : dateKeyLabel(localDateKey(new Date()), { weekday: "long", month: "long", day: "numeric" }),
  );
  return (
    <p suppressHydrationWarning className="min-h-5 text-sm text-muted-foreground">
      {label}
    </p>
  );
}
