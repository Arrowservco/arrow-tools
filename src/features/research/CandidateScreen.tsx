"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pct } from "@/lib/format";
import type { ProductIdentity } from "@/lib/ai/schemas/research";

type Candidate = ProductIdentity["candidates"][number];

export function CandidateScreen({
  identity,
  onSelect,
  onSearchAgain,
  onContinue,
}: {
  identity: ProductIdentity;
  onSelect: (candidate: Candidate | null) => void;
  onSearchAgain: () => void;
  onContinue: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Which exact product is this?</CardTitle>
        <CardDescription>
          Identity confidence is {pct(identity.identityConfidence)} ({identity.matchLevel.replace(/_/g, " ")}).
          Resale numbers are only as good as the product match — pick the exact model if you can.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {identity.candidates.slice(0, 3).map((c, i) => (
          <div key={`${c.productName}-${i}`} className="rounded-md border p-3">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{c.productName}</p>
                <p className="text-sm text-muted-foreground">
                  {[c.brand, c.model].filter(Boolean).join(" · ") || "Brand/model unknown"}
                </p>
              </div>
              <Badge variant={c.matchConfidence >= 0.8 ? "success" : c.matchConfidence >= 0.5 ? "warning" : "destructive"}>
                {pct(c.matchConfidence)}
              </Badge>
            </div>
            <p className="text-sm">{c.whyItMayMatch}</p>
            {c.importantDifferences && (
              <p className="mt-1 text-sm text-warning">Differences: {c.importantDifferences}</p>
            )}
            <Button size="sm" className="mt-2" onClick={() => onSelect(c)}>
              Select this product
            </Button>
          </div>
        ))}
        {identity.notes && <p className="text-xs text-muted-foreground">{identity.notes}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onSearchAgain}>
            Search again
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onContinue}>
            Continue with current match
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
