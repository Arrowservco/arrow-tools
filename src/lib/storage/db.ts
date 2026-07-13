import Dexie, { type EntityTable } from "dexie";
import type { EvaluationResult } from "@/types/domain";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";

/** Predicted-vs-actual tracking entered by the user after the auction. */
export interface ActualOutcome {
  status: "won" | "lost" | null;
  actualPurchaseCents: number | null;
  actualSaleCents: number | null;
  actualEbayFeesCents: number | null;
  actualShippingCents: number | null;
  daysToSell: number | null;
  returned: boolean | null;
  notes: string;
}

export interface EvaluationRecord {
  id: string;
  createdAt: string;
  /** Small JPEG data URL for list display; never contains the full image. */
  thumbnailDataUrl: string | null;
  productTitle: string;
  verdict: string;
  currentBidCents: number;
  instantWinCents: number | null;
  protectionEnabled: boolean;
  maxBidCents: number | null;
  expectedSaleCents: number | null;
  conservativeNetCents: number | null;
  expectedNetCents: number | null;
  conservativeRoi: number | null;
  expectedRoi: number | null;
  velocityScore: number | null;
  confidence: number | null;
  demo: boolean;
  /** Full payloads for reopen/recalculate. */
  result: EvaluationResult;
  extraction: MacBidScreenshotExtraction;
  actual: ActualOutcome;
}

export class BidLensDB extends Dexie {
  evaluations!: EntityTable<EvaluationRecord, "id">;
  constructor() {
    super("bidlens");
    this.version(1).stores({
      evaluations: "id, createdAt, productTitle, verdict",
    });
  }
}

export const db = new BidLensDB();

export function emptyActual(): ActualOutcome {
  return {
    status: null,
    actualPurchaseCents: null,
    actualSaleCents: null,
    actualEbayFeesCents: null,
    actualShippingCents: null,
    daysToSell: null,
    returned: null,
    notes: "",
  };
}

export function recordFromResult(
  result: EvaluationResult,
  extraction: MacBidScreenshotExtraction,
  thumbnailDataUrl: string | null,
): EvaluationRecord {
  const cons = result.auction.scenarios?.conservative ?? null;
  const exp = result.auction.scenarios?.expected ?? null;
  return {
    id: result.evaluationId,
    createdAt: result.createdAt,
    thumbnailDataUrl,
    productTitle: result.listing.title,
    verdict: result.headlineVerdict,
    currentBidCents: result.listing.currentBidCents,
    instantWinCents: result.listing.instantWinCents,
    protectionEnabled: result.listing.protectionEnabled,
    maxBidCents: result.maxBid.recommendedMaxBidCents,
    expectedSaleCents: result.research.stats.expectedCents,
    conservativeNetCents: cons?.netProfitCents ?? null,
    expectedNetCents: exp?.netProfitCents ?? null,
    conservativeRoi: cons?.acquisitionRoi ?? null,
    expectedRoi: exp?.acquisitionRoi ?? null,
    velocityScore: result.velocity.score,
    confidence: result.listing.identityConfidence,
    demo: result.demo,
    result,
    extraction,
    actual: emptyActual(),
  };
}
