import { applyRate, type Cents } from "@/lib/money";
import { calculateEbayFees } from "@/lib/calculations/ebayFees";
import type {
  AcquisitionBreakdown,
  EbayFeeProfile,
  ItemCondition,
  ScenarioResult,
  SellingExpenseBreakdown,
  ShippingEstimate,
} from "@/types/domain";

/** Base return-risk reserve rate by condition (fraction of sale price). */
export function baseReturnReserveRate(condition: ItemCondition): number {
  switch (condition) {
    case "new":
      return 0.02;
    case "like_new":
      return 0.04;
    case "open_box":
      return 0.05;
    case "used":
      return 0.08;
    case "damaged":
    case "parts_only":
      return 0.12;
    case "unknown":
    default:
      return 0.08;
  }
}

export interface ScenarioInput {
  name: ScenarioResult["name"];
  salePriceCents: Cents;
  buyerShippingCents: Cents;
  shippingLabelCents: Cents;
  packagingCents: Cents;
  returnReserveRate: number;
  accessoryAllowanceCents: Cents;
  acquisition: AcquisitionBreakdown;
  ebay: EbayFeeProfile;
  promotionRateOverride?: number;
}

export function computeScenario(input: ScenarioInput): ScenarioResult {
  const fees = calculateEbayFees({
    itemPriceCents: input.salePriceCents,
    buyerShippingCents: input.buyerShippingCents,
    profile: input.ebay,
    promotionRateOverride: input.promotionRateOverride,
  });

  const returnRiskReserveCents = applyRate(input.salePriceCents, input.returnReserveRate);

  const expenses: SellingExpenseBreakdown = {
    finalValueFeeCents: fees.finalValueFeeCents,
    perOrderFeeCents: fees.perOrderFeeCents,
    promotedListingFeeCents: fees.promotedListingFeeCents,
    feeBufferCents: fees.feeBufferCents + fees.internationalFeeCents,
    shippingLabelCents: input.shippingLabelCents,
    packagingCents: input.packagingCents,
    returnRiskReserveCents,
    accessoryAllowanceCents: input.accessoryAllowanceCents,
    totalCents: 0,
  };
  expenses.totalCents =
    expenses.finalValueFeeCents +
    expenses.perOrderFeeCents +
    expenses.promotedListingFeeCents +
    expenses.feeBufferCents +
    expenses.shippingLabelCents +
    expenses.packagingCents +
    expenses.returnRiskReserveCents +
    expenses.accessoryAllowanceCents;

  const transactionRevenueCents = input.salePriceCents + input.buyerShippingCents;
  const acquisitionTotalCents = input.acquisition.totalCents;
  const netProfitCents = transactionRevenueCents - expenses.totalCents - acquisitionTotalCents;

  const acquisitionRoi =
    acquisitionTotalCents > 0 ? netProfitCents / acquisitionTotalCents : null;
  const totalCash = acquisitionTotalCents + input.shippingLabelCents + input.packagingCents;
  const totalCashRoi = totalCash > 0 ? netProfitCents / totalCash : null;

  return {
    name: input.name,
    salePriceCents: input.salePriceCents,
    buyerShippingCents: input.buyerShippingCents,
    transactionRevenueCents,
    expenses,
    acquisitionTotalCents,
    netProfitCents,
    acquisitionRoi,
    totalCashRoi,
  };
}

export interface ScenarioSetInput {
  quickSaleCents: Cents;
  expectedCents: Cents;
  patientCents: Cents;
  shipping: ShippingEstimate;
  condition: ItemCondition;
  /** Accessory completeness uncertain → conservative scenario carries an allowance. */
  accessoryUncertain: boolean;
  acquisition: AcquisitionBreakdown;
  ebay: EbayFeeProfile;
  promotionRateOverride?: number;
}

export function accessoryAllowanceCents(expectedPriceCents: Cents): Cents {
  // 10% of expected resale, capped at $25.
  return Math.min(2500, applyRate(expectedPriceCents, 0.1));
}

/**
 * Build the conservative / expected / best-reasonable scenario set.
 * The conservative scenario controls the final verdict.
 */
export function computeScenarioSet(input: ScenarioSetInput): {
  conservative: ScenarioResult;
  expected: ScenarioResult;
  best: ScenarioResult;
} {
  const base = baseReturnReserveRate(input.condition);
  const allowance = input.accessoryUncertain
    ? accessoryAllowanceCents(input.expectedCents)
    : 0;

  const common = {
    buyerShippingCents: input.shipping.buyerChargeCents,
    packagingCents: input.shipping.packagingCents,
    acquisition: input.acquisition,
    ebay: input.ebay,
    promotionRateOverride: input.promotionRateOverride,
  };

  return {
    conservative: computeScenario({
      ...common,
      name: "conservative",
      salePriceCents: input.quickSaleCents,
      shippingLabelCents: input.shipping.conservativeLabelCents,
      returnReserveRate: base * 1.5,
      accessoryAllowanceCents: allowance,
    }),
    expected: computeScenario({
      ...common,
      name: "expected",
      salePriceCents: input.expectedCents,
      shippingLabelCents: input.shipping.expectedLabelCents,
      returnReserveRate: base,
      accessoryAllowanceCents: 0,
    }),
    best: computeScenario({
      ...common,
      name: "best",
      salePriceCents: input.patientCents,
      shippingLabelCents: input.shipping.expectedLabelCents,
      returnReserveRate: base * 0.6,
      accessoryAllowanceCents: 0,
    }),
  };
}
