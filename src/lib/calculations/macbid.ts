import { applyRate, type Cents } from "@/lib/money";
import type { AcquisitionBreakdown, MacBidFeeProfile } from "@/types/domain";

export interface AcquisitionInput {
  hammerBidCents: Cents;
  protectionCents: Cents; // 0 when protection off
  fees: MacBidFeeProfile;
  displayedTotalCents?: Cents | null;
  useDisplayedTotal?: boolean;
}

export const DISPLAYED_TOTAL_DISCREPANCY_WARN_CENTS = 50;

/**
 * Deterministic Mac.bid acquisition cost:
 * hammer + buyer premium + lot fee + optional protection + transfer fee + sales tax.
 * The taxable base is configurable via the profile.
 */
export function calculateAcquisition(input: AcquisitionInput): AcquisitionBreakdown {
  const { hammerBidCents, protectionCents, fees } = input;
  const buyerPremiumCents = applyRate(hammerBidCents, fees.buyerPremiumRate);
  const lotFeeCents = fees.lotFeeCents;
  const transferFeeCents = fees.transferFeeCents;

  let taxBase = 0;
  if (fees.taxableBase.hammerBid) taxBase += hammerBidCents;
  if (fees.taxableBase.buyerPremium) taxBase += buyerPremiumCents;
  if (fees.taxableBase.lotFee) taxBase += lotFeeCents;
  if (fees.taxableBase.protection) taxBase += protectionCents;
  if (fees.taxableBase.transferFee) taxBase += transferFeeCents;

  const salesTaxCents = applyRate(taxBase, fees.salesTaxRate);

  const calculatedTotal =
    hammerBidCents +
    buyerPremiumCents +
    lotFeeCents +
    protectionCents +
    transferFeeCents +
    salesTaxCents;

  const displayedTotalCents = input.displayedTotalCents ?? null;
  const discrepancyCents =
    displayedTotalCents !== null ? Math.abs(displayedTotalCents - calculatedTotal) : null;
  const discrepancyWarning =
    discrepancyCents !== null && discrepancyCents > DISPLAYED_TOTAL_DISCREPANCY_WARN_CENTS;
  const usedDisplayedTotal = Boolean(input.useDisplayedTotal && displayedTotalCents !== null);

  return {
    hammerBidCents,
    buyerPremiumCents,
    lotFeeCents,
    protectionCents,
    transferFeeCents,
    salesTaxCents,
    totalCents: usedDisplayedTotal ? (displayedTotalCents as Cents) : calculatedTotal,
    displayedTotalCents,
    discrepancyCents,
    discrepancyWarning,
    usedDisplayedTotal,
  };
}
