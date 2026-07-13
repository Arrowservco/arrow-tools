"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db, type EvaluationRecord } from "@/lib/storage/db";
import { ResultsView } from "@/features/results/ResultsView";
import type { EvaluationResult } from "@/types/domain";

export function EvaluationDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<EvaluationRecord | null | "missing">(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    db.evaluations
      .get(id)
      .then((r) => {
        if (r) {
          setRecord(r);
          setResult(r.result);
        } else {
          setRecord("missing");
        }
      })
      .catch(() => setRecord("missing"));
  }, [id]);

  if (record === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (record === "missing" || !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evaluation not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This evaluation isn&apos;t in this browser&apos;s local history.
          </p>
          <Button asChild variant="outline">
            <Link href="/history">Back to history</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <ResultsView
        result={result}
        onResultChange={(r) => {
          setResult(r);
          setDirty(true);
        }}
        saved={!dirty}
        onSave={async () => {
          try {
            await db.evaluations.update(record.id, {
              result,
              verdict: result.headlineVerdict,
              currentBidCents: result.listing.currentBidCents,
              instantWinCents: result.listing.instantWinCents,
              protectionEnabled: result.listing.protectionEnabled,
              maxBidCents: result.maxBid.recommendedMaxBidCents,
              conservativeNetCents: result.auction.scenarios?.conservative.netProfitCents ?? null,
              expectedNetCents: result.auction.scenarios?.expected.netProfitCents ?? null,
              conservativeRoi: result.auction.scenarios?.conservative.acquisitionRoi ?? null,
              expectedRoi: result.auction.scenarios?.expected.acquisitionRoi ?? null,
              velocityScore: result.velocity.score,
            });
            setDirty(false);
            toast.success("Recalculated result saved.");
          } catch {
            toast.error("Could not save (storage error).");
          }
        }}
      />
    </div>
  );
}
