import { applyRate, type Cents } from "@/lib/money";
import type { EbayFeeProfile } from "@/types/domain";

export interface EbayFeeInput {
  itemPriceCents: Cents;
  buyerShippingCents: Cents;
  profile: EbayFeeProfile;
  /** Override the profile promotion rate for scenario grids. */
  promotionRateOverride?: number;
}

export interface EbayFeeResult {
  feeBaseCents: Cents;
  finalValueFeeCents: Cents;
  perOrderFeeCents: Cents;
  promotedListingFeeCents: Cents;
  internationalFeeCents: Cents;
  feeBufferCents: Cents;
  totalCents: Cents;
  promotionRate: number;
}

/**
 * eBay fees for a non-store seller. The final-value fee and the promoted
 * listing fee both apply to the full transaction amount (item price +
 * buyer-paid shipping) — buyer-paid shipping is NOT fee-free.
 */
export function calculateEbayFees(input: EbayFeeInput): EbayFeeResult {
  const { profile } = input;
  const promotionRate = input.promotionRateOverride ?? profile.promotionRate;
  const feeBaseCents = input.itemPriceCents + input.buyerShippingCents;

  const finalValueFeeCents = applyRate(feeBaseCents, profile.finalValueFeeRate);
  const promotedListingFeeCents = applyRate(feeBaseCents, promotionRate);
  const internationalFeeCents = applyRate(feeBaseCents, profile.internationalFeeRate);
  const perOrderFeeCents = profile.perOrderFeeCents;
  const preBuffer =
    finalValueFeeCents + promotedListingFeeCents + internationalFeeCents + perOrderFeeCents;
  const feeBufferCents = applyRate(preBuffer, profile.feeBufferRate);

  return {
    feeBaseCents,
    finalValueFeeCents,
    perOrderFeeCents,
    promotedListingFeeCents,
    internationalFeeCents,
    feeBufferCents,
    totalCents: preBuffer + feeBufferCents,
    promotionRate,
  };
}
