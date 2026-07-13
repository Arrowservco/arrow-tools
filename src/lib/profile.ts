import type { EbayFeeProfile, SourcingProfile } from "@/types/domain";

/**
 * eBay final-value-fee rates by category for sellers WITHOUT a store
 * subscription. These are configurable assumptions, not live eBay data —
 * they can be edited per evaluation and should be reviewed periodically
 * against eBay's published fee schedule.
 */
export const EBAY_CATEGORY_FEE_RATES: Record<string, number> = {
  "Most Categories": 0.1335,
  "Consumer Electronics": 0.1335,
  "Tools & Home Improvement": 0.1335,
  "Home & Garden": 0.1335,
  "Toys & Hobbies": 0.1335,
  "Sporting Goods": 0.1335,
  "Computers/Tablets": 0.1325,
  "Cameras & Photo": 0.1325,
  "Video Game Consoles": 0.1325,
  "Cell Phones & Smartphones": 0.1325,
  "Clothing & Accessories": 0.15,
  "Jewelry & Watches": 0.15,
  "Musical Instruments (Guitars)": 0.0635,
};

/** Fallback rate used when the category is uncertain. Clearly labeled in UI. */
export const FALLBACK_FINAL_VALUE_FEE_RATE = 0.1335;

/** Per-order fixed fee (non-store): $0.30 for orders $10+, $0.40 rule simplified. */
export const DEFAULT_PER_ORDER_FEE_CENTS = 40;

export const PROMOTION_PRESETS = [0, 0.02, 0.05] as const;

export function resolveCategoryFeeRate(category: string | null): {
  rate: number;
  isFallback: boolean;
  category: string;
} {
  if (category && EBAY_CATEGORY_FEE_RATES[category] !== undefined) {
    return { rate: EBAY_CATEGORY_FEE_RATES[category], isFallback: false, category };
  }
  return {
    rate: FALLBACK_FINAL_VALUE_FEE_RATE,
    isFallback: true,
    category: category ?? "Unknown",
  };
}

export function defaultEbayFeeProfile(category?: string | null): EbayFeeProfile {
  const resolved = resolveCategoryFeeRate(category ?? null);
  return {
    storeSubscription: "none",
    category: resolved.category,
    finalValueFeeRate: resolved.rate,
    isFallbackRate: resolved.isFallback,
    perOrderFeeCents: DEFAULT_PER_ORDER_FEE_CENTS,
    promotionRate: 0.05,
    feeBufferRate: 0,
    internationalFeeRate: 0,
  };
}

/** The locked "Eric Standard" sourcing profile. */
export function ericStandardProfile(): SourcingProfile {
  return {
    name: "Eric Standard",
    originZip: "15146",
    conservativeDestinationZip: "90001",
    macBid: {
      buyerPremiumRate: 0.15,
      lotFeeCents: 300,
      salesTaxRate: 0.06,
      transferFeeCents: 0,
      taxableBase: {
        hammerBid: true,
        buyerPremium: true,
        lotFee: true,
        protection: true,
        transferFee: true,
      },
    },
    ebay: defaultEbayFeeProfile(),
    thresholds: {
      minNetProfitCents: 2000,
      minExpectedRoi: 0.75,
      minConservativeRoi: 0.5,
      absoluteMaxBidCents: null,
      roundBidsToWholeDollars: true,
    },
    fallbackFinalValueFeeRate: FALLBACK_FINAL_VALUE_FEE_RATE,
  };
}
