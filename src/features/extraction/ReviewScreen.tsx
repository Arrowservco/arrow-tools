"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Pencil, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { confidenceBadge, conditionLabel } from "@/lib/format";
import { dollarsToCents, formatCents } from "@/lib/money";
import { preliminaryScreen } from "@/lib/calculations/evaluate";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { ListingOverrides } from "@/lib/pipeline";
import type { SourcingProfile } from "@/types/domain";

const numeric = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().min(0).nullable(),
);

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  brand: z.string(),
  model: z.string(),
  condition: z.enum(["new", "like_new", "open_box", "used", "damaged", "parts_only", "unknown"]),
  currentBid: numeric,
  instantWin: numeric,
  retailPrice: numeric,
  protectionPrice: numeric,
  protectionEnabled: z.boolean(),
  pickupLocation: z.string(),
  displayedTotal: numeric,
  useDisplayedTotal: z.boolean(),
  buyerPremiumPct: z.coerce.number().min(0).max(100),
  lotFee: z.coerce.number().min(0),
  salesTaxPct: z.coerce.number().min(0).max(100),
  transferFee: z.coerce.number().min(0),
});
type FormValues = z.infer<typeof formSchema>;

export function ReviewScreen({
  extraction,
  overrides,
  previewUrl,
  profile,
  onChange,
  onConfirm,
  onCancel,
}: {
  extraction: MacBidScreenshotExtraction;
  overrides: ListingOverrides;
  previewUrl: string | null;
  profile: SourcingProfile;
  onChange: (o: ListingOverrides) => void;
  onConfirm: (o: ListingOverrides, profile: SourcingProfile) => void;
  onCancel: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const defaults: FormValues = useMemo(
    () => ({
      title: overrides.title ?? extraction.product.title.value ?? "",
      brand: overrides.brand ?? extraction.product.brand.value ?? "",
      model: overrides.model ?? extraction.product.modelNumber.value ?? "",
      condition: overrides.condition ?? extraction.product.condition.value ?? "unknown",
      currentBid: overrides.currentBid ?? extraction.auction.currentBid.value,
      instantWin: overrides.instantWin ?? extraction.instantWin.price.value,
      retailPrice: overrides.retailPrice ?? extraction.macBid.displayedRetailPrice.value,
      protectionPrice: overrides.protectionPrice ?? extraction.protection.price.value,
      protectionEnabled:
        overrides.protectionEnabled ?? extraction.protection.enabledInScreenshot.value ?? false,
      pickupLocation: overrides.pickupLocation ?? extraction.macBid.pickupLocation.value ?? "",
      displayedTotal: overrides.displayedTotal ?? extraction.macBid.displayedAllInTotal.value,
      useDisplayedTotal: overrides.useDisplayedTotal ?? false,
      buyerPremiumPct: profile.macBid.buyerPremiumRate * 100,
      lotFee: profile.macBid.lotFeeCents / 100,
      salesTaxPct: profile.macBid.salesTaxRate * 100,
      transferFee: profile.macBid.transferFeeCents / 100,
    }),
    [extraction, overrides, profile],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: defaults,
    mode: "onChange",
  });
  const values = form.watch();

  const toOverrides = (v: FormValues): ListingOverrides => ({
    title: v.title,
    brand: v.brand || null,
    model: v.model || null,
    condition: v.condition,
    currentBid: v.currentBid,
    instantWin: v.instantWin,
    retailPrice: v.retailPrice,
    protectionPrice: v.protectionPrice,
    protectionEnabled: v.protectionEnabled,
    pickupLocation: v.pickupLocation || null,
    displayedTotal: v.displayedTotal,
    useDisplayedTotal: v.useDisplayedTotal,
  });

  const toProfile = (v: FormValues): SourcingProfile => ({
    ...profile,
    macBid: {
      ...profile.macBid,
      buyerPremiumRate: v.buyerPremiumPct / 100,
      lotFeeCents: dollarsToCents(v.lotFee),
      salesTaxRate: v.salesTaxPct / 100,
      transferFeeCents: dollarsToCents(v.transferFee),
    },
  });

  const prelim = useMemo(() => {
    const p = toProfile(values);
    const retail = values.retailPrice === null ? null : dollarsToCents(values.retailPrice);
    const protection = values.protectionEnabled ? dollarsToCents(values.protectionPrice ?? 0) : 0;
    const auction = preliminaryScreen({
      priceCents: dollarsToCents(values.currentBid ?? 0),
      retailCents: retail,
      profile: p,
      protectionCents: protection,
    });
    const iw =
      values.instantWin === null
        ? null
        : preliminaryScreen({
            priceCents: dollarsToCents(values.instantWin),
            retailCents: retail,
            profile: p,
            protectionCents: protection,
          });
    return { auction, iw };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.currentBid, values.instantWin, values.retailPrice, values.protectionEnabled, values.protectionPrice, values.buyerPremiumPct, values.lotFee, values.salesTaxPct, values.transferFee]);

  const submit = form.handleSubmit((v) => {
    onChange(toOverrides(v));
    onConfirm(toOverrides(v), toProfile(v));
  });

  const fieldRow = (
    label: string,
    value: string,
    confidence: number,
  ) => {
    const badge = confidenceBadge(confidence);
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex items-center gap-2 text-right text-sm font-medium">
          {value || "—"}
          <Badge variant={badge.tone === "success" ? "success" : badge.tone === "warning" ? "warning" : "destructive"}>
            {badge.label}
          </Badge>
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Check what BidLens read</CardTitle>
          <CardDescription>
            Confidence badges show how sure the extraction is. Fix anything wrong before research runs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previewUrl} alt="Screenshot being analyzed" className="max-h-56 w-full rounded-md border object-contain" />
          )}

          {extraction.warnings.length > 0 && (
            <div role="note" className="rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle aria-hidden className="h-4 w-4 text-warning" /> Extraction warnings
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {extraction.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {!editing ? (
            <div className="divide-y" data-testid="review-summary">
              {fieldRow("Product", values.title, extraction.product.title.confidence)}
              {fieldRow("Brand", values.brand, extraction.product.brand.confidence)}
              {fieldRow("Model", values.model, extraction.product.modelNumber.confidence)}
              {fieldRow("Condition", conditionLabel(values.condition), extraction.product.condition.confidence)}
              {fieldRow(
                "Current bid",
                values.currentBid === null ? "—" : formatCents(dollarsToCents(values.currentBid)),
                extraction.auction.currentBid.confidence,
              )}
              {fieldRow(
                "Instant Win",
                values.instantWin === null ? "—" : formatCents(dollarsToCents(values.instantWin)),
                extraction.instantWin.price.confidence,
              )}
              {fieldRow(
                "Est. retail",
                values.retailPrice === null ? "—" : formatCents(dollarsToCents(values.retailPrice)),
                extraction.macBid.displayedRetailPrice.confidence,
              )}
              {fieldRow(
                "Protection",
                `${values.protectionEnabled ? "On" : "Off"}${values.protectionPrice !== null ? ` (${formatCents(dollarsToCents(values.protectionPrice))})` : ""}`,
                extraction.protection.price.confidence,
              )}
            </div>
          ) : (
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
              <div className="sm:col-span-2">
                <Label htmlFor="rv-title">Product title</Label>
                <Input id="rv-title" data-testid="review-title" {...form.register("title")} />
              </div>
              <div>
                <Label htmlFor="rv-brand">Brand</Label>
                <Input id="rv-brand" {...form.register("brand")} />
              </div>
              <div>
                <Label htmlFor="rv-model">Model</Label>
                <Input id="rv-model" {...form.register("model")} />
              </div>
              <div>
                <Label htmlFor="rv-condition">Condition</Label>
                <Select id="rv-condition" {...form.register("condition")}>
                  {["new", "like_new", "open_box", "used", "damaged", "parts_only", "unknown"].map((c) => (
                    <option key={c} value={c}>
                      {conditionLabel(c)}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="rv-bid">Current bid ($)</Label>
                <Input id="rv-bid" type="number" step="0.01" inputMode="decimal" {...form.register("currentBid")} />
              </div>
              <div>
                <Label htmlFor="rv-iw">Instant Win ($)</Label>
                <Input id="rv-iw" type="number" step="0.01" inputMode="decimal" {...form.register("instantWin")} />
              </div>
              <div>
                <Label htmlFor="rv-retail">Retail price ($)</Label>
                <Input id="rv-retail" type="number" step="0.01" inputMode="decimal" {...form.register("retailPrice")} />
              </div>
              <div>
                <Label htmlFor="rv-prot">Protection amount ($)</Label>
                <Input id="rv-prot" type="number" step="0.01" inputMode="decimal" {...form.register("protectionPrice")} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                <Label htmlFor="rv-prot-on">Protection on</Label>
                <Switch
                  id="rv-prot-on"
                  checked={values.protectionEnabled}
                  onCheckedChange={(c) => form.setValue("protectionEnabled", c)}
                />
              </div>
              <div>
                <Label htmlFor="rv-pickup">Pickup location</Label>
                <Input id="rv-pickup" {...form.register("pickupLocation")} />
              </div>
              <div>
                <Label htmlFor="rv-transfer">Transfer fee ($)</Label>
                <Input id="rv-transfer" type="number" step="0.01" inputMode="decimal" {...form.register("transferFee")} />
              </div>
              <div>
                <Label htmlFor="rv-premium">Buyer&apos;s premium (%)</Label>
                <Input id="rv-premium" type="number" step="0.1" inputMode="decimal" {...form.register("buyerPremiumPct")} />
              </div>
              <div>
                <Label htmlFor="rv-lot">Lot fee ($)</Label>
                <Input id="rv-lot" type="number" step="0.01" inputMode="decimal" {...form.register("lotFee")} />
              </div>
              <div>
                <Label htmlFor="rv-tax">Sales tax (%)</Label>
                <Input id="rv-tax" type="number" step="0.1" inputMode="decimal" {...form.register("salesTaxPct")} />
              </div>
              <div>
                <Label htmlFor="rv-total">Displayed total ($)</Label>
                <Input id="rv-total" type="number" step="0.01" inputMode="decimal" {...form.register("displayedTotal")} />
              </div>
              {values.displayedTotal !== null && (
                <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                  <Label htmlFor="rv-use-total">Use displayed total instead of calculated</Label>
                  <Switch
                    id="rv-use-total"
                    checked={values.useDisplayedTotal}
                    onCheckedChange={(c) => form.setValue("useDisplayedTotal", c)}
                  />
                </div>
              )}
            </form>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant={prelim.auction.worthResearching ? "success" : "destructive"}>
              Auction: {prelim.auction.worthResearching ? "Worth Researching" : "Preliminary Pass"}
            </Badge>
            {prelim.iw && (
              <Badge variant={prelim.iw.worthResearching ? "success" : "destructive"}>
                Instant Win: {prelim.iw.worthResearching ? "Worth Researching" : "Preliminary Pass"}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="flex-1" data-testid="confirm-research" onClick={submit}>
              <Search /> Looks Right, Research Product
            </Button>
            <Button
              size="lg"
              variant="outline"
              data-testid="edit-details"
              onClick={() => setEditing((e) => !e)}
            >
              <Pencil /> {editing ? "Done Editing" : "Edit Details"}
            </Button>
          </div>
          <Button variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
