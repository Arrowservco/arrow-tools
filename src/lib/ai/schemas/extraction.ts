import { z } from "zod";

/** Confidence-wrapped value: null means "not visible / not sure". */
export const confidenceValue = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    value: inner.nullable(),
    confidence: z.number().min(0).max(1).catch(0),
    sourceText: z.string().nullable().optional(),
  });

export const conditionEnum = z.enum([
  "new",
  "like_new",
  "open_box",
  "used",
  "damaged",
  "parts_only",
  "unknown",
]);

export const macBidScreenshotExtractionSchema = z.object({
  product: z.object({
    title: confidenceValue(z.string()),
    brand: confidenceValue(z.string()),
    modelNumber: confidenceValue(z.string()),
    upc: confidenceValue(z.string()),
    mpn: confidenceValue(z.string()),
    categoryGuess: confidenceValue(z.string()),
    condition: confidenceValue(conditionEnum),
    includedItems: z.array(z.string()).catch([]),
    possiblyMissingItems: z.array(z.string()).catch([]),
  }),
  auction: z.object({
    currentBid: confidenceValue(z.number()),
    bidCount: confidenceValue(z.number()),
    timeRemainingText: confidenceValue(z.string()),
    auctionEndTime: confidenceValue(z.string()),
  }),
  instantWin: z.object({
    available: confidenceValue(z.boolean()),
    price: confidenceValue(z.number()),
    timeRemainingText: confidenceValue(z.string()),
    expirationTime: confidenceValue(z.string()),
  }),
  macBid: z.object({
    displayedRetailPrice: confidenceValue(z.number()),
    displayedAllInTotal: confidenceValue(z.number()),
    buyerPremiumRate: confidenceValue(z.number()),
    lotFee: confidenceValue(z.number()),
    taxAmount: confidenceValue(z.number()),
    salesTaxRate: confidenceValue(z.number()),
    pickupLocation: confidenceValue(z.string()),
    transferEligible: confidenceValue(z.boolean()),
    transferFee: confidenceValue(z.number()),
  }),
  protection: z.object({
    available: confidenceValue(z.boolean()),
    price: confidenceValue(z.number()),
    enabledInScreenshot: confidenceValue(z.boolean()),
  }),
  warnings: z.array(z.string()).catch([]),
  uncertainFields: z.array(z.string()).catch([]),
  overallConfidence: z.number().min(0).max(1).catch(0),
});

export type MacBidScreenshotExtraction = z.infer<typeof macBidScreenshotExtractionSchema>;

/** A fully-null extraction skeleton, used for manual entry mode. */
export function emptyExtraction(): MacBidScreenshotExtraction {
  const cv = <T>(value: T | null = null, confidence = 0) => ({ value, confidence, sourceText: null });
  return {
    product: {
      title: cv<string>(),
      brand: cv<string>(),
      modelNumber: cv<string>(),
      upc: cv<string>(),
      mpn: cv<string>(),
      categoryGuess: cv<string>(),
      condition: cv<"unknown">("unknown", 0),
      includedItems: [],
      possiblyMissingItems: [],
    },
    auction: {
      currentBid: cv<number>(),
      bidCount: cv<number>(),
      timeRemainingText: cv<string>(),
      auctionEndTime: cv<string>(),
    },
    instantWin: {
      available: cv<boolean>(),
      price: cv<number>(),
      timeRemainingText: cv<string>(),
      expirationTime: cv<string>(),
    },
    macBid: {
      displayedRetailPrice: cv<number>(),
      displayedAllInTotal: cv<number>(),
      buyerPremiumRate: cv<number>(),
      lotFee: cv<number>(),
      taxAmount: cv<number>(),
      salesTaxRate: cv<number>(),
      pickupLocation: cv<string>(),
      transferEligible: cv<boolean>(),
      transferFee: cv<number>(),
    },
    protection: {
      available: cv<boolean>(),
      price: cv<number>(),
      enabledInScreenshot: cv<boolean>(),
    },
    warnings: [],
    uncertainFields: [],
    overallConfidence: 0,
  };
}
