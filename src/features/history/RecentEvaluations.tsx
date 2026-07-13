"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/storage/db";
import { formatCents } from "@/lib/money";
import { VERDICT_LABEL, VERDICT_TONE } from "@/lib/format";
import type { Verdict } from "@/types/domain";

export function RecentEvaluations() {
  const recent = useLiveQuery(() => db.evaluations.orderBy("createdAt").reverse().limit(5).toArray(), []);

  if (!recent || recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Recent evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nothing yet. Analyze a screenshot (or try the Demo) and saved evaluations will show up here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">Recent evaluations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recent.map((r) => {
          const tone = VERDICT_TONE[r.verdict as Verdict] ?? "muted";
          return (
            <Link
              key={r.id}
              href={`/evaluation/${r.id}`}
              className="flex items-center gap-3 rounded-md border p-2 transition-colors hover:bg-muted"
            >
              {r.thumbnailDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.thumbnailDataUrl} alt="" className="h-12 w-9 rounded object-cover" />
              ) : (
                <div aria-hidden className="h-12 w-9 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.productTitle}</p>
                <p className="text-xs text-muted-foreground">
                  Bid {formatCents(r.currentBidCents)}
                  {r.maxBidCents !== null ? ` · Max ${formatCents(r.maxBidCents, { hideCentsIfWhole: true })}` : ""}
                </p>
              </div>
              <Badge
                variant={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "destructive" ? "destructive" : "secondary"}
              >
                {VERDICT_LABEL[r.verdict as Verdict] ?? r.verdict}
              </Badge>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
