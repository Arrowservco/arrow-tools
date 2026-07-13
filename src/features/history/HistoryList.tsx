"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Trash2, Trophy, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, type EvaluationRecord } from "@/lib/storage/db";
import { dollarsToCents, formatCents } from "@/lib/money";
import { pct, VERDICT_LABEL, VERDICT_TONE } from "@/lib/format";
import type { Verdict } from "@/types/domain";

export function HistoryList() {
  const records = useLiveQuery(() => db.evaluations.orderBy("createdAt").reverse().toArray(), []);
  const [actualFor, setActualFor] = useState<EvaluationRecord | null>(null);

  if (!records) return null;
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No evaluations yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Run an analysis from the Analyze tab (the Demo works without any API key) and save it — it will
            appear here. History lives only in this browser (IndexedDB).
          </p>
        </CardContent>
      </Card>
    );
  }

  const exportJson = (r: EvaluationRecord) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bidlens-${r.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const duplicate = async (r: EvaluationRecord) => {
    const id = crypto.randomUUID();
    await db.evaluations.put({
      ...r,
      id,
      createdAt: new Date().toISOString(),
      result: { ...r.result, evaluationId: id },
    });
    toast.success("Duplicated — open it from the list to adjust and recalculate.");
  };

  const setStatus = async (r: EvaluationRecord, status: "won" | "lost") => {
    await db.evaluations.update(r.id, { actual: { ...r.actual, status } });
    toast.success(status === "won" ? "Marked as won." : "Marked as lost.");
  };

  return (
    <div className="space-y-3">
      {records.map((r) => {
        const tone = VERDICT_TONE[r.verdict as Verdict] ?? "muted";
        const predicted = r.expectedNetCents;
        const actualNet =
          r.actual.actualSaleCents !== null &&
          r.actual.actualPurchaseCents !== null
            ? r.actual.actualSaleCents -
              r.actual.actualPurchaseCents -
              (r.actual.actualEbayFeesCents ?? 0) -
              (r.actual.actualShippingCents ?? 0)
            : null;
        return (
          <Card key={r.id} data-testid="history-item">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                {r.thumbnailDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={r.thumbnailDataUrl} alt="" className="h-16 w-12 rounded object-cover" />
                ) : (
                  <div aria-hidden className="h-16 w-12 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-medium">{r.productTitle}</p>
                    <Badge variant={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "destructive" ? "destructive" : "secondary"}>
                      {VERDICT_LABEL[r.verdict as Verdict] ?? r.verdict}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · bid {formatCents(r.currentBidCents)}
                    {r.instantWinCents !== null && ` · IW ${formatCents(r.instantWinCents)}`}
                    {r.maxBidCents !== null && ` · max ${formatCents(r.maxBidCents, { hideCentsIfWhole: true })}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cons. net {r.conservativeNetCents !== null ? formatCents(r.conservativeNetCents) : "—"} · exp. net{" "}
                    {r.expectedNetCents !== null ? formatCents(r.expectedNetCents) : "—"} · ROI{" "}
                    {pct(r.expectedRoi)} · velocity {r.velocityScore ?? "—"}
                    {r.demo && " · DEMO"}
                  </p>
                  {r.actual.status && (
                    <p className="text-xs">
                      <span className={r.actual.status === "won" ? "text-success" : "text-muted-foreground"}>
                        {r.actual.status === "won" ? "WON" : "LOST"}
                      </span>
                      {actualNet !== null && predicted !== null && (
                        <span className="text-muted-foreground">
                          {" "}· actual net {formatCents(actualNet)} vs predicted {formatCents(predicted)} (
                          {formatCents(actualNet - predicted)} diff)
                          {r.actual.daysToSell !== null && ` · sold in ${r.actual.daysToSell}d`}
                          {r.actual.returned ? " · RETURNED" : ""}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/evaluation/${r.id}`}>
                    <ExternalLink /> Open
                  </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={() => duplicate(r)}>
                  <Copy /> Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportJson(r)}>
                  <Download /> Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r, "won")}>
                  <Trophy /> Won
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r, "lost")}>
                  <XCircle /> Lost
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActualFor(r)}>
                  Actuals
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    await db.evaluations.delete(r.id);
                    toast.success("Deleted.");
                  }}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <ActualsDialog record={actualFor} onClose={() => setActualFor(null)} />
    </div>
  );
}

function ActualsDialog({ record, onClose }: { record: EvaluationRecord | null; onClose: () => void }) {
  if (!record) return null;
  const a = record.actual;
  const numOrNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "");
    return s === "" ? null : dollarsToCents(Number(s));
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actual outcome</DialogTitle>
          <DialogDescription>
            Track what really happened to compare against BidLens&apos;s prediction.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await db.evaluations.update(record.id, {
              actual: {
                ...a,
                actualPurchaseCents: numOrNull(fd.get("purchase")),
                actualSaleCents: numOrNull(fd.get("sale")),
                actualEbayFeesCents: numOrNull(fd.get("fees")),
                actualShippingCents: numOrNull(fd.get("shipping")),
                daysToSell: String(fd.get("days") ?? "") === "" ? null : Number(fd.get("days")),
                returned: fd.get("returned") === "on",
              },
            });
            toast.success("Actuals saved.");
            onClose();
          }}
        >
          <div>
            <Label htmlFor="act-purchase">Purchase price ($)</Label>
            <Input id="act-purchase" name="purchase" type="number" step="0.01" inputMode="decimal"
              defaultValue={a.actualPurchaseCents !== null ? (a.actualPurchaseCents / 100).toFixed(2) : ""} />
          </div>
          <div>
            <Label htmlFor="act-sale">Sale price ($)</Label>
            <Input id="act-sale" name="sale" type="number" step="0.01" inputMode="decimal"
              defaultValue={a.actualSaleCents !== null ? (a.actualSaleCents / 100).toFixed(2) : ""} />
          </div>
          <div>
            <Label htmlFor="act-fees">eBay fees ($)</Label>
            <Input id="act-fees" name="fees" type="number" step="0.01" inputMode="decimal"
              defaultValue={a.actualEbayFeesCents !== null ? (a.actualEbayFeesCents / 100).toFixed(2) : ""} />
          </div>
          <div>
            <Label htmlFor="act-ship">Shipping cost ($)</Label>
            <Input id="act-ship" name="shipping" type="number" step="0.01" inputMode="decimal"
              defaultValue={a.actualShippingCents !== null ? (a.actualShippingCents / 100).toFixed(2) : ""} />
          </div>
          <div>
            <Label htmlFor="act-days">Days to sell</Label>
            <Input id="act-days" name="days" type="number" inputMode="numeric"
              defaultValue={a.daysToSell ?? ""} />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <input id="act-returned" name="returned" type="checkbox" defaultChecked={a.returned ?? false} className="h-5 w-5" />
            <Label htmlFor="act-returned">Item was returned</Label>
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save actuals</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
