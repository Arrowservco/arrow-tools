import type { Cents } from "@/lib/money";
import { roundCents } from "@/lib/money";
import type { ShippingBand, ShippingEstimate } from "@/types/domain";

/**
 * Category shipping bands for the 15146 -> 90001 conservative route.
 * These are deliberately conservative planning numbers, not live carrier
 * rates. Every figure is editable on the results screen.
 */
export interface ShippingBandSpec {
  band: ShippingBand;
  label: string;
  maxPackedWeightOz: number;
  defaultPackedWeightOz: number;
  suggestedService: string;
  buyerChargeCents: Cents;
  expectedLabelCents: Cents;
  conservativeLabelCents: Cents;
  packagingCents: Cents;
  dimensionalWeightRisk: boolean;
}

export const SHIPPING_BANDS: Record<ShippingBand, ShippingBandSpec> = {
  small_lightweight: {
    band: "small_lightweight",
    label: "Small / lightweight (≤ 1 lb)",
    maxPackedWeightOz: 16,
    defaultPackedWeightOz: 12,
    suggestedService: "USPS Ground Advantage",
    buyerChargeCents: 699,
    expectedLabelCents: 550,
    conservativeLabelCents: 750,
    packagingCents: 100,
    dimensionalWeightRisk: false,
  },
  small_dense: {
    band: "small_dense",
    label: "Small / dense (1–3 lb)",
    maxPackedWeightOz: 48,
    defaultPackedWeightOz: 36,
    suggestedService: "USPS Ground Advantage",
    buyerChargeCents: 1099,
    expectedLabelCents: 900,
    conservativeLabelCents: 1250,
    packagingCents: 150,
    dimensionalWeightRisk: false,
  },
  medium: {
    band: "medium",
    label: "Medium (3–10 lb)",
    maxPackedWeightOz: 160,
    defaultPackedWeightOz: 96,
    suggestedService: "USPS Ground Advantage / UPS Ground",
    buyerChargeCents: 1599,
    expectedLabelCents: 1400,
    conservativeLabelCents: 1900,
    packagingCents: 250,
    dimensionalWeightRisk: true,
  },
  large: {
    band: "large",
    label: "Large (10–30 lb)",
    maxPackedWeightOz: 480,
    defaultPackedWeightOz: 288,
    suggestedService: "UPS Ground / FedEx Home Delivery",
    buyerChargeCents: 2999,
    expectedLabelCents: 2600,
    conservativeLabelCents: 3600,
    packagingCents: 400,
    dimensionalWeightRisk: true,
  },
  oversized: {
    band: "oversized",
    label: "Oversized (30–70 lb or bulky)",
    maxPackedWeightOz: 1120,
    defaultPackedWeightOz: 640,
    suggestedService: "UPS Ground (oversize)",
    buyerChargeCents: 5999,
    expectedLabelCents: 5500,
    conservativeLabelCents: 7500,
    packagingCents: 700,
    dimensionalWeightRisk: true,
  },
  freight_like: {
    band: "freight_like",
    label: "Freight-like (70 lb+ / pallet)",
    maxPackedWeightOz: Infinity,
    defaultPackedWeightOz: 1600,
    suggestedService: "LTL freight / local pickup only",
    buyerChargeCents: 17500,
    expectedLabelCents: 17500,
    conservativeLabelCents: 25000,
    packagingCents: 1500,
    dimensionalWeightRisk: true,
  },
};

export function bandForPackedWeightOz(oz: number): ShippingBand {
  if (oz <= 16) return "small_lightweight";
  if (oz <= 48) return "small_dense";
  if (oz <= 160) return "medium";
  if (oz <= 480) return "large";
  if (oz <= 1120) return "oversized";
  return "freight_like";
}

export interface ShippingEstimateInput {
  band?: ShippingBand | null;
  itemWeightOz?: number | null;
  packedWeightOz?: number | null;
  packageDimensionsIn?: { l: number; w: number; h: number } | null;
  destinationZip?: string;
  source?: ShippingEstimate["source"];
  confidence?: number;
  overrides?: Partial<
    Pick<
      ShippingEstimate,
      "buyerChargeCents" | "expectedLabelCents" | "conservativeLabelCents" | "packagingCents"
    >
  >;
}

/** Packaging adds roughly 15% to item weight, minimum 4 oz. */
export function estimatePackedWeightOz(itemWeightOz: number): number {
  return roundCents(itemWeightOz + Math.max(4, itemWeightOz * 0.15)) / 1; // integer oz-ish
}

export function estimateShipping(input: ShippingEstimateInput): ShippingEstimate {
  const itemWeightOz = input.itemWeightOz ?? null;
  let packedWeightOz = input.packedWeightOz ?? null;
  if (packedWeightOz === null && itemWeightOz !== null) {
    packedWeightOz = estimatePackedWeightOz(itemWeightOz);
  }
  const band: ShippingBand =
    input.band ?? (packedWeightOz !== null ? bandForPackedWeightOz(packedWeightOz) : "medium");
  const spec = SHIPPING_BANDS[band];
  if (packedWeightOz === null) packedWeightOz = spec.defaultPackedWeightOz;

  const dims = input.packageDimensionsIn ?? null;
  // Dimensional weight risk: carrier dim divisor 139 in^3/lb.
  let dimensionalWeightRisk = spec.dimensionalWeightRisk;
  if (dims) {
    const dimWeightLb = (dims.l * dims.w * dims.h) / 139;
    dimensionalWeightRisk = dimWeightLb * 16 > packedWeightOz * 1.25;
  }

  const assumptions: string[] = [
    `Category band: ${spec.label}`,
    `Origin ZIP 15146 → destination ZIP ${input.destinationZip ?? "90001"} (conservative cross-country route)`,
    `Rates are planning estimates, not live carrier quotes`,
  ];
  if (input.overrides?.expectedLabelCents !== undefined) assumptions.push("Label cost manually overridden");

  return {
    band,
    itemWeightOz,
    packedWeightOz,
    packageDimensionsIn: dims,
    dimensionalWeightRisk,
    suggestedService: spec.suggestedService,
    buyerChargeCents: input.overrides?.buyerChargeCents ?? spec.buyerChargeCents,
    expectedLabelCents: input.overrides?.expectedLabelCents ?? spec.expectedLabelCents,
    conservativeLabelCents:
      input.overrides?.conservativeLabelCents ??
      Math.max(
        spec.conservativeLabelCents,
        input.overrides?.expectedLabelCents !== undefined
          ? roundCents(input.overrides.expectedLabelCents * 1.3)
          : 0,
      ),
    packagingCents: input.overrides?.packagingCents ?? spec.packagingCents,
    confidence: input.confidence ?? (input.source === "manual_override" ? 0.9 : 0.5),
    source: input.source ?? "category_default",
    destinationZip: input.destinationZip ?? "90001",
    assumptions,
  };
}
