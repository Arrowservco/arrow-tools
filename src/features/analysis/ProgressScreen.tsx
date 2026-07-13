"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type StageKey = "read" | "identify" | "market" | "shipping" | "maxbid";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "read", label: "Reading Mac.bid details" },
  { key: "identify", label: "Identifying product" },
  { key: "market", label: "Researching resale market" },
  { key: "shipping", label: "Estimating shipping" },
  { key: "maxbid", label: "Calculating maximum bid" },
];

export function ProgressScreen({ stage }: { stage: StageKey }) {
  const index = STAGES.findIndex((s) => s.key === stage);
  const current = STAGES[index];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyzing…</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={((index + 0.5) / STAGES.length) * 100} aria-hidden />
        <p aria-live="polite" role="status" className="sr-only">
          {current.label}
        </p>
        <ol className="space-y-3">
          {STAGES.map((s, i) => (
            <li key={s.key} className={cn("flex items-center gap-3 text-sm", i > index && "text-muted-foreground")}>
              {i < index ? (
                <CheckCircle2 aria-hidden className="h-5 w-5 text-success" />
              ) : i === index ? (
                <Loader2 aria-hidden className="h-5 w-5 animate-spin text-accent" />
              ) : (
                <span aria-hidden className="inline-block h-5 w-5 rounded-full border" />
              )}
              {s.label}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
