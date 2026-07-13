"use client";

import { useMemo, useState } from "react";
import { Download, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatCents, formatRate, dollarsToCents, type Cents } from "@/lib/money";
import { pct, RISK_LABEL, VELOCITY_LABEL_TEXT, VERDICT_LABEL, VERDICT_TONE, conditionLabel } from "@/lib/format";
import { reevaluate } from "@/lib/pipeline";
import type { EvaluationResult } from "@/types/domain";
import { cn } from "@/lib/utils";

/* ------------------------------ small helpers ------------------------------ */

function MoneyInput({
  id,
  label,
  cents,
  onCommit,
  testId,
}: {
  id: string;
  label: string;
  cents: Cents | null;
  onCommit: (cents: Cents | null) => void;
  testId?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        data-testid={testId}
        type="number"
        step="0.01"
        inputMode="decimal"
        defaultValue={cents === null ? "" : (cents / 100).toFixed(2)}
        key={`${id}-${cents ?? "null"}`}
        onBlur={(e) => {
          const v = e.target.value;
          onCommit(v === "" ? null : dollarsToCents(Number(v)));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </div>
  );
}

function Row({ label, value, strong, testId }: { label: string; value: string; strong?: boolean; testId?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span data-testid={testId} className={cn("text-sm tabular-nums", strong && "font-semibold")}>
        {value}
      </span>
    </div>
  );
}

function money(cents: Cents | null | undefined): string {
  return cents === null || cents === undefined ? "—" : formatCents(cents);
}

const toneClasses: Record<string, string> = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-white dark:text-black",
  destructive: "bg-destructive text-destructive-foreground",
  muted: "bg-muted text-muted-foreground",
};

/* --------------------------------- main view -------------------------------- */

export function ResultsView({
  result,
  onResultChange,
  onSave,
  saved,
  onStartOver,
}: {
  result: EvaluationResult;
  onResultChange: (r: EvaluationResult) => void;
  onSave: () => void;
  saved: boolean;
  onStartOver?: () => void;
}) {
  const r = result;
  const cons = r.auction.scenarios?.conservative ?? null;
  const exp = r.auction.scenarios?.expected ?? null;
  const best = r.auction.scenarios?.best ?? null;
  const [customPromo, setCustomPromo] = useState<string>("");

  const apply = (changes: Parameters<typeof reevaluate>[1]) => onResultChange(reevaluate(r, changes));

  // Protection comparison (with vs without) — instant, deterministic.
  const protectionCompare = useMemo(() => {
    if (r.listing.protectionCents === null) return null;
    const withOn = r.listing.protectionEnabled ? r : reevaluate(r, { listing: { protectionEnabled: true } });
    const withOff = r.listing.protectionEnabled ? reevaluate(r, { listing: { protectionEnabled: false } }) : r;
    return { on: withOn, off: withOff };
  }, [r]);

  const verdictTone = VERDICT_TONE[r.headlineVerdict];
  const headline =
    r.headlineVerdict === "buy_below" && r.auction.buyBelowCents !== null
      ? `BUY BELOW ${formatCents(r.auction.buyBelowCents, { hideCentsIfWhole: true })}`
      : VERDICT_LABEL[r.headlineVerdict];

  const verifiedRetail = r.research.verifiedRetailCents;

  return (
    <div className="space-y-4 pb-6">
      {r.demo && (
        <p role="note" className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm font-medium">
          Demo data, not live market evidence.
        </p>
      )}
      {r.research.stats.provisional && !r.demo && (
        <p role="note" className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-sm">
          Provisional resale estimate — sold evidence is weak; conservative fallback pricing applied.
        </p>
      )}

      {/* Verdict */}
      <section aria-labelledby="verdict-heading" className={cn("rounded-lg p-5 text-center", toneClasses[verdictTone])}>
        <h2 id="verdict-heading" data-testid="verdict-headline" className="text-3xl font-extrabold tracking-tight">
          {headline}
        </h2>
        <p className="mt-1 text-sm opacity-90">{r.headlineDetail}</p>
      </section>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="Conservative Net" value={money(cons?.netProfitCents)} testId="metric-conservative-net"
          tone={cons && cons.netProfitCents >= r.profile.thresholds.minNetProfitCents ? "good" : "bad"} />
        <MetricCard label="Expected Net" value={money(exp?.netProfitCents)} testId="metric-expected-net"
          tone={exp && exp.netProfitCents >= r.profile.thresholds.minNetProfitCents ? "good" : "bad"} />
        <MetricCard label="Conservative ROI" value={pct(cons?.acquisitionRoi)} testId="metric-conservative-roi"
          tone={cons?.acquisitionRoi != null && cons.acquisitionRoi >= r.profile.thresholds.minConservativeRoi ? "good" : "bad"} />
        <MetricCard
          label="Cash Velocity"
          value={`${r.velocity.score} · ${VELOCITY_LABEL_TEXT[r.velocity.label]}${r.velocity.lowConfidence ? " (low conf.)" : ""}`}
          testId="metric-velocity"
          tone={r.velocity.score >= 60 ? "good" : "bad"}
        />
      </div>

      {/* Auction & Instant Win */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="auction-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Auction
              <VerdictBadge verdict={r.auction.verdict} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Current bid" value={money(r.listing.currentBidCents)} />
            <Row label="Current all-in cost" value={money(r.auction.acquisition?.totalCents)} />
            <Row label="Maximum bid" value={money(r.maxBid.recommendedMaxBidCents)} strong testId="auction-max-bid" />
            <Row label="Maximum protected bid" value={money(r.maxBid.maxProtectedBidCents)} />
            <Row
              label="Bid room remaining"
              value={r.maxBid.bidRoomCents === null ? "—" : money(r.maxBid.bidRoomCents)}
              testId="auction-bid-room"
            />
            <Row label="Time remaining" value={timeRemaining(r, "auction")} />
            <p className="mt-2 text-xs text-muted-foreground">{r.auction.verdictDetail}</p>
          </CardContent>
        </Card>

        <Card data-testid="instant-win-card">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Instant Win
              {r.instantWin.applicable ? <VerdictBadge verdict={r.instantWin.verdict} /> : <Badge variant="secondary">N/A</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {r.instantWin.applicable ? (
              <>
                <Row label="Instant Win price" value={money(r.listing.instantWinCents)} testId="instant-win-price" />
                <Row label="All-in Instant Win cost" value={money(r.instantWin.acquisition?.totalCents)} />
                <Row label="Expected net profit" value={money(r.instantWin.scenarios?.expected.netProfitCents)} />
                <Row label="Conservative ROI" value={pct(r.instantWin.scenarios?.conservative.acquisitionRoi)} />
                <Row
                  label={`Resale needed to net ${formatCents(r.profile.thresholds.minNetProfitCents, { hideCentsIfWhole: true })}`}
                  value={money(r.instantWin.requiredResaleForMinProfitCents)}
                />
                <Row label="Max profitable IW price" value={money(r.maxBid.maxInstantWinCents)} />
                <Row label="Offer expires" value={timeRemaining(r, "instant_win")} />
                <p className="mt-2 text-xs text-muted-foreground">{r.instantWin.verdictDetail}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{r.instantWin.verdictDetail}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mac.bid cost */}
      <Card>
        <CardHeader>
          <CardTitle>Mac.bid Cost (at current bid)</CardTitle>
        </CardHeader>
        <CardContent>
          {r.auction.acquisition && (
            <>
              <Row label="Hammer bid" value={money(r.auction.acquisition.hammerBidCents)} />
              <Row label={`Buyer's premium (${formatRate(r.profile.macBid.buyerPremiumRate)})`} value={money(r.auction.acquisition.buyerPremiumCents)} />
              <Row label="Lot fee" value={money(r.auction.acquisition.lotFeeCents)} />
              <Row label="Protection" value={money(r.auction.acquisition.protectionCents)} />
              <Row label="Transfer fee" value={money(r.auction.acquisition.transferFeeCents)} />
              <Row label={`Sales tax (${formatRate(r.profile.macBid.salesTaxRate)})`} value={money(r.auction.acquisition.salesTaxCents)} />
              <Separator className="my-2" />
              <Row label="Total acquisition cost" value={money(r.auction.acquisition.totalCents)} strong testId="acquisition-total" />
              {r.auction.acquisition.displayedTotalCents !== null && (
                <>
                  <Row label="Screenshot displayed total" value={money(r.auction.acquisition.displayedTotalCents)} />
                  <Row label="Difference" value={money(r.auction.acquisition.discrepancyCents)} />
                  {r.auction.acquisition.discrepancyWarning && (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      Displayed and calculated totals differ by more than $0.50 — double-check the fees.
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between rounded-md border p-3">
                    <Label htmlFor="use-displayed">Use displayed total for the evaluation</Label>
                    <Switch
                      id="use-displayed"
                      checked={r.listing.useDisplayedTotal}
                      onCheckedChange={(c) => apply({ listing: { useDisplayedTotal: c } })}
                    />
                  </div>
                </>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MoneyInput id="edit-bid" label="Current bid ($)" cents={r.listing.currentBidCents}
                  onCommit={(c) => apply({ listing: { currentBidCents: c ?? 0 } })} testId="edit-current-bid" />
                <MoneyInput id="edit-iw" label="Instant Win ($)" cents={r.listing.instantWinCents}
                  onCommit={(c) => apply({ listing: { instantWinCents: c } })} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resale estimate */}
      <Card>
        <CardHeader>
          <CardTitle>Resale Estimate</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Evidence" value={`${r.research.stats.soldCompCount} sold / ${r.research.stats.acceptedCompCount} accepted comps (${r.research.stats.evidenceGrade.replace(/_/g, " ")})`} />
          <Row label="Median (accepted)" value={money(r.research.stats.medianCents)} />
          <Row label="25th–75th percentile" value={`${money(r.research.stats.p25Cents)} – ${money(r.research.stats.p75Cents)}`} />
          <Row label="Verified retail" value={money(verifiedRetail)} />
          <Row label="Active competition" value={r.research.stats.activeCompetitionCount === null ? "—" : `≈${r.research.stats.activeCompetitionCount} listings`} />
          <Row label="Market confidence" value={pct(r.research.stats.marketConfidence)} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MoneyInput id="quick-price" label="Quick sale" cents={r.research.stats.quickSaleCents}
              onCommit={(c) => apply({ stats: { quickSaleCents: c } })} />
            <MoneyInput id="market-price" label="Market" cents={r.research.stats.expectedCents}
              onCommit={(c) => apply({ stats: { expectedCents: c } })} />
            <MoneyInput id="patient-price" label="Patient" cents={r.research.stats.patientCents}
              onCommit={(c) => apply({ stats: { patientCents: c } })} />
          </div>
          {r.research.stats.notes.map((n) => (
            <p key={n} className="mt-2 text-xs text-muted-foreground">{n}</p>
          ))}
        </CardContent>
      </Card>

      {/* Shipping */}
      <Card>
        <CardHeader>
          <CardTitle>Buyer-Paid Shipping</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Band" value={r.shipping.band.replace(/_/g, " ")} />
          <Row label="Suggested service" value={r.shipping.suggestedService} />
          <Row label="Packed weight" value={`${r.shipping.packedWeightOz} oz`} />
          <Row
            label="Package dims"
            value={r.shipping.packageDimensionsIn ? `${r.shipping.packageDimensionsIn.l}×${r.shipping.packageDimensionsIn.w}×${r.shipping.packageDimensionsIn.h} in` : "—"}
          />
          <Row label="Dimensional-weight risk" value={r.shipping.dimensionalWeightRisk ? "Yes" : "No"} />
          <Row label="Confidence" value={pct(r.shipping.confidence)} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MoneyInput id="ship-charge" label="Buyer charge ($)" cents={r.shipping.buyerChargeCents}
              onCommit={(c) => apply({ shipping: { buyerChargeCents: c ?? 0 } })} />
            <MoneyInput id="ship-label" label="Expected label ($)" cents={r.shipping.expectedLabelCents}
              onCommit={(c) => apply({ shipping: { expectedLabelCents: c ?? 0 } })} />
            <MoneyInput id="ship-label-cons" label="Conservative label ($)" cents={r.shipping.conservativeLabelCents}
              onCommit={(c) => apply({ shipping: { conservativeLabelCents: c ?? 0 } })} />
            <MoneyInput id="ship-pack" label="Packaging ($)" cents={r.shipping.packagingCents}
              onCommit={(c) => apply({ shipping: { packagingCents: c ?? 0 } })} />
            <div>
              <Label htmlFor="ship-weight">Packed weight (oz)</Label>
              <Input id="ship-weight" type="number" inputMode="decimal" defaultValue={r.shipping.packedWeightOz}
                key={`w-${r.shipping.packedWeightOz}`}
                onBlur={(e) => apply({ shipping: { packedWeightOz: Number(e.target.value) || r.shipping.packedWeightOz } })} />
            </div>
            <div>
              <Label htmlFor="ship-zip">Destination ZIP</Label>
              <Input id="ship-zip" defaultValue={r.shipping.destinationZip} key={`z-${r.shipping.destinationZip}`}
                onBlur={(e) => apply({ shipping: { destinationZip: e.target.value || r.shipping.destinationZip } })} />
            </div>
          </div>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            {r.shipping.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* eBay fees */}
      <Card>
        <CardHeader>
          <CardTitle>eBay Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <Row
            label={r.profile.ebay.isFallbackRate ? "Final value fee (fallback non-Store fee assumption)" : `Final value fee (${r.profile.ebay.category})`}
            value={formatRate(r.profile.ebay.finalValueFeeRate, 2)}
          />
          <Row label="Per-order fee" value={money(r.profile.ebay.perOrderFeeCents)} />
          <Row label="Fee base" value="Item price + buyer-paid shipping" />
          {exp && (
            <>
              <Row label="FVF (expected scenario)" value={money(exp.expenses.finalValueFeeCents)} />
              <Row label="Promotion (expected scenario)" value={money(exp.expenses.promotedListingFeeCents)} />
              <Row label="Return-risk reserve" value={money(exp.expenses.returnRiskReserveCents)} />
              {cons && cons.expenses.accessoryAllowanceCents > 0 && (
                <Row label="Accessory allowance (conservative)" value={money(cons.expenses.accessoryAllowanceCents)} />
              )}
            </>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="fvf-rate">FVF rate (%)</Label>
              <Input id="fvf-rate" type="number" step="0.01" inputMode="decimal"
                defaultValue={(r.profile.ebay.finalValueFeeRate * 100).toFixed(2)}
                key={`fvf-${r.profile.ebay.finalValueFeeRate}`}
                onBlur={(e) =>
                  apply({
                    profile: {
                      ...r.profile,
                      ebay: { ...r.profile.ebay, finalValueFeeRate: (Number(e.target.value) || 0) / 100, isFallbackRate: false },
                    },
                  })
                }
              />
            </div>
            <MoneyInput id="per-order" label="Per-order fee ($)" cents={r.profile.ebay.perOrderFeeCents}
              onCommit={(c) =>
                apply({ profile: { ...r.profile, ebay: { ...r.profile.ebay, perOrderFeeCents: c ?? 0 } } })
              } />
          </div>
        </CardContent>
      </Card>

      {/* Promotion scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Promotion Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-end gap-2" role="group" aria-label="Promoted listing rate">
            {[0, 0.02, 0.05].map((rate) => (
              <Button
                key={rate}
                size="sm"
                data-testid={`promo-${rate * 100}`}
                variant={Math.abs(r.profile.ebay.promotionRate - rate) < 1e-9 ? "accent" : "outline"}
                onClick={() => apply({ profile: { ...r.profile, ebay: { ...r.profile.ebay, promotionRate: rate } } })}
              >
                {formatRate(rate)}
              </Button>
            ))}
            <div className="flex items-end gap-1">
              <div>
                <Label htmlFor="promo-custom" className="text-xs">Custom %</Label>
                <Input id="promo-custom" type="number" step="0.1" inputMode="decimal" className="h-9 w-24"
                  value={customPromo} onChange={(e) => setCustomPromo(e.target.value)} />
              </div>
              <Button size="sm" variant="outline"
                onClick={() => {
                  const v = Number(customPromo);
                  if (!Number.isNaN(v) && v >= 0 && v <= 100) {
                    apply({ profile: { ...r.profile, ebay: { ...r.profile.ebay, promotionRate: v / 100 } } });
                  }
                }}>
                Apply
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Net profit at different promoted-listing rates</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">Promo rate</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Conservative net</th>
                  <th scope="col" className="py-1 font-medium">Expected net</th>
                </tr>
              </thead>
              <tbody>
                {r.promotionScenarios.map((s) => (
                  <tr key={s.rate} className={cn("border-b last:border-0", Math.abs(s.rate - r.profile.ebay.promotionRate) < 1e-9 && "font-semibold")}>
                    <td className="py-1 pr-2">{formatRate(s.rate)}</td>
                    <td className="py-1 pr-2 tabular-nums">{money(s.conservativeNetCents)}</td>
                    <td className="py-1 tabular-nums">{money(s.expectedNetCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Selected rate: {formatRate(r.profile.ebay.promotionRate)}. Higher-ticket items with strong organic
            demand can often run 0–2%.
          </p>
        </CardContent>
      </Card>

      {/* Protection */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase Protection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="protection-switch">
              Protection {r.listing.protectionCents !== null ? `(${formatCents(r.listing.protectionCents)})` : ""}
            </Label>
            <Switch
              id="protection-switch"
              data-testid="protection-switch"
              checked={r.listing.protectionEnabled}
              onCheckedChange={(c) => apply({ listing: { protectionEnabled: c } })}
            />
          </div>
          {protectionCompare && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Comparison with and without purchase protection</caption>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className="py-1 pr-2 font-medium">Metric</th>
                    <th scope="col" className="py-1 pr-2 font-medium">Protection off</th>
                    <th scope="col" className="py-1 font-medium">Protection on</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-1 pr-2">Conservative net</td>
                    <td className="py-1 pr-2 tabular-nums">{money(protectionCompare.off.auction.scenarios?.conservative.netProfitCents)}</td>
                    <td className="py-1 tabular-nums" data-testid="protection-on-net">{money(protectionCompare.on.auction.scenarios?.conservative.netProfitCents)}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-1 pr-2">Conservative ROI</td>
                    <td className="py-1 pr-2 tabular-nums">{pct(protectionCompare.off.auction.scenarios?.conservative.acquisitionRoi)}</td>
                    <td className="py-1 tabular-nums">{pct(protectionCompare.on.auction.scenarios?.conservative.acquisitionRoi)}</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2">Maximum bid</td>
                    <td className="py-1 pr-2 tabular-nums">{money(protectionCompare.off.maxBid.recommendedMaxBidCents)}</td>
                    <td className="py-1 tabular-nums">{money(protectionCompare.on.maxBid.recommendedMaxBidCents)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <MoneyInput id="protection-price" label="Protection price ($)" cents={r.listing.protectionCents}
            onCommit={(c) => apply({ listing: { protectionCents: c } })} />
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. Worth considering for electronics, hard-to-test, fragile, or accessory-incomplete items;
            usually unnecessary for cheap, simple, easily inspected products. BidLens never enables it automatically.
          </p>
        </CardContent>
      </Card>

      {/* Maximum bid */}
      <Card>
        <CardHeader>
          <CardTitle>Maximum Bid</CardTitle>
        </CardHeader>
        <CardContent>
          <Row label="Profit-based maximum bid" value={money(r.maxBid.profitCeilingCents)} />
          <Row label="ROI-based maximum bid" value={money(r.maxBid.roiCeilingCents)} />
          <Row label="Recommended maximum bid" value={money(r.maxBid.recommendedMaxBidCents)} strong testId="recommended-max-bid" />
          <Row label="Maximum protected bid" value={money(r.maxBid.maxProtectedBidCents)} />
          <Row label="Maximum Instant Win price" value={money(r.maxBid.maxInstantWinCents)} />
          {r.maxBid.cappedByProfile && (
            <p className="mt-1 text-xs text-warning">Capped by the absolute bid limit in your profile.</p>
          )}
          {r.maxBid.recommendedMaxBidCents === null && (
            <p className="mt-1 text-xs text-destructive">
              No bid clears the {formatCents(r.profile.thresholds.minNetProfitCents)} profit floor and ROI floors under
              conservative assumptions.
            </p>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MoneyInput id="floor-profit" label="Min net profit ($)" cents={r.profile.thresholds.minNetProfitCents}
              onCommit={(c) =>
                apply({ profile: { ...r.profile, thresholds: { ...r.profile.thresholds, minNetProfitCents: c ?? 0 } } })
              } />
            <div>
              <Label htmlFor="floor-exp-roi">Expected ROI floor (%)</Label>
              <Input id="floor-exp-roi" type="number" inputMode="decimal"
                defaultValue={(r.profile.thresholds.minExpectedRoi * 100).toFixed(0)}
                key={`er-${r.profile.thresholds.minExpectedRoi}`}
                onBlur={(e) =>
                  apply({ profile: { ...r.profile, thresholds: { ...r.profile.thresholds, minExpectedRoi: (Number(e.target.value) || 0) / 100 } } })
                } />
            </div>
            <div>
              <Label htmlFor="floor-cons-roi">Conservative ROI floor (%)</Label>
              <Input id="floor-cons-roi" type="number" inputMode="decimal"
                defaultValue={(r.profile.thresholds.minConservativeRoi * 100).toFixed(0)}
                key={`cr-${r.profile.thresholds.minConservativeRoi}`}
                onBlur={(e) =>
                  apply({ profile: { ...r.profile, thresholds: { ...r.profile.thresholds, minConservativeRoi: (Number(e.target.value) || 0) / 100 } } })
                } />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario detail */}
      {cons && exp && best && (
        <Card>
          <CardHeader>
            <CardTitle>Scenario Detail (auction)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Conservative, expected, and best-reasonable scenarios</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-1 pr-2 font-medium">Metric</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Conservative</th>
                  <th scope="col" className="py-1 pr-2 font-medium">Expected</th>
                  <th scope="col" className="py-1 font-medium">Best</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sale price", cons.salePriceCents, exp.salePriceCents, best.salePriceCents],
                  ["Buyer shipping", cons.buyerShippingCents, exp.buyerShippingCents, best.buyerShippingCents],
                  ["Revenue", cons.transactionRevenueCents, exp.transactionRevenueCents, best.transactionRevenueCents],
                  ["Selling expenses", cons.expenses.totalCents, exp.expenses.totalCents, best.expenses.totalCents],
                  ["Acquisition", cons.acquisitionTotalCents, exp.acquisitionTotalCents, best.acquisitionTotalCents],
                  ["Net profit", cons.netProfitCents, exp.netProfitCents, best.netProfitCents],
                ].map(([label, a, b, c]) => (
                  <tr key={label as string} className="border-b last:border-0">
                    <td className="py-1 pr-2">{label}</td>
                    <td className="py-1 pr-2 tabular-nums">{money(a as number)}</td>
                    <td className="py-1 pr-2 tabular-nums">{money(b as number)}</td>
                    <td className="py-1 tabular-nums">{money(c as number)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 pr-2">Acquisition ROI</td>
                  <td className="py-1 pr-2 tabular-nums">{pct(cons.acquisitionRoi)}</td>
                  <td className="py-1 pr-2 tabular-nums">{pct(exp.acquisitionRoi)}</td>
                  <td className="py-1 tabular-nums">{pct(best.acquisitionRoi)}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-2">Total-cash ROI</td>
                  <td className="py-1 pr-2 tabular-nums">{pct(cons.totalCashRoi)}</td>
                  <td className="py-1 pr-2 tabular-nums">{pct(exp.totalCashRoi)}</td>
                  <td className="py-1 tabular-nums">{pct(best.totalCashRoi)}</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Market evidence */}
      <Card>
        <CardHeader>
          <CardTitle>Market Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.research.comparables.length === 0 && (
            <p className="text-sm text-muted-foreground">No comparables available.</p>
          )}
          {r.research.comparables.map((c, i) => (
            <div key={`${c.sourceTitle}-${i}`} className={cn("rounded-md border p-2 text-sm", !c.accepted && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.sourceTitle}</span>
                <Badge variant={c.soldStatus === "sold" ? "success" : c.soldStatus === "active" ? "secondary" : "outline"}>
                  {c.soldStatus}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {money(c.priceCents)}
                {c.shippingCents !== null ? ` + ${formatCents(c.shippingCents)} ship` : ""} · {c.condition ?? "cond. unknown"}
                {c.dateText ? ` · ${c.dateText}` : ""} · relevance {pct(c.relevanceScore)}
              </p>
              {c.exclusionReason && <p className="text-xs text-destructive">Excluded: {c.exclusionReason}</p>}
              {c.sourceUrl && (
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
                  {c.sourceUrl}
                </a>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Velocity factors */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Velocity — {r.velocity.score}/100 ({VELOCITY_LABEL_TEXT[r.velocity.label]})</CardTitle>
        </CardHeader>
        <CardContent>
          {r.velocity.lowConfidence && (
            <p className="mb-2 text-xs text-warning">Low confidence — sold evidence is thin, treat as a rough guide.</p>
          )}
          <div className="space-y-1">
            {r.velocity.factors.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{f.label} <span className="text-xs">(w{f.weight})</span></span>
                <span className="tabular-nums">{Math.round(f.score * 100)} — <span className="text-xs text-muted-foreground">{f.note}</span></span>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <Row label="Quick-sale price" value={money(r.research.stats.quickSaleCents)} />
          <Row label="Market price" value={money(r.research.stats.expectedCents)} />
          <Row label="Patient price" value={money(r.research.stats.patientCents)} />
        </CardContent>
      </Card>

      {/* Risk */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Analysis — overall {RISK_LABEL[r.risk.overall]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {r.risk.flags.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.detail}</p>
              </div>
              <Badge variant={f.level === "low" ? "success" : f.level === "moderate" ? "warning" : "destructive"}>
                {RISK_LABEL[f.level]}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Explanation */}
      {r.explanation && (
        <Card>
          <CardHeader>
            <CardTitle>AI Explanation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{r.explanation}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Narrative only — every number above comes from BidLens&apos;s deterministic calculator, not the model.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assumptions */}
      <Card>
        <CardHeader>
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          {r.assumptions.map((a) => (
            <Row key={a.key} label={`${a.label} (${a.source})`} value={a.value} />
          ))}
          <Row label="Product" value={`${r.listing.title}${r.listing.model ? ` (${r.listing.model})` : ""}`} />
          <Row label="Condition" value={conditionLabel(r.listing.condition)} />
          <Row label="Identity confidence" value={pct(r.listing.identityConfidence)} />
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {r.research.sources.length === 0 && <p className="text-sm text-muted-foreground">No sources recorded.</p>}
          {r.research.sources.map((s, i) => (
            <p key={`${s.title}-${i}`} className="text-sm">
              <span className="font-medium">{s.title}</span>{" "}
              <span className="text-xs text-muted-foreground">({s.kind.replace(/_/g, " ")}{s.note ? ` — ${s.note}` : ""})</span>
              {s.url && (
                <>
                  {" "}
                  <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-xs text-accent underline">
                    {s.url}
                  </a>
                </>
              )}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="flex-1" data-testid="save-evaluation" onClick={onSave} disabled={saved}>
          <Save /> {saved ? "Saved to history" : "Save evaluation"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `bidlens-${r.evaluationId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> Export JSON
        </Button>
        {onStartOver && (
          <Button size="lg" variant="ghost" onClick={onStartOver}>
            <RotateCcw /> New analysis
          </Button>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone, testId }: { label: string; value: string; tone: "good" | "bad"; testId?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p data-testid={testId} className={cn("mt-1 text-lg font-bold tabular-nums", tone === "good" ? "text-success" : "text-destructive")}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function VerdictBadge({ verdict }: { verdict: EvaluationResult["headlineVerdict"] }) {
  const tone = VERDICT_TONE[verdict];
  return (
    <Badge variant={tone === "success" ? "success" : tone === "warning" ? "warning" : tone === "destructive" ? "destructive" : "secondary"}>
      {VERDICT_LABEL[verdict]}
    </Badge>
  );
}

function timeRemaining(r: EvaluationResult, channel: "auction" | "instant_win"): string {
  // Countdown text is captured from the screenshot — it is point-in-time.
  const text = channel === "auction" ? r.listing.auctionTimeText : r.listing.instantWinTimeText;
  return text ? `${text} (at capture)` : "—";
}
