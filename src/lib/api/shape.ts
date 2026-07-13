import { centsToDollars } from "@/lib/money";
import type { EvaluationResult } from "@/types/domain";

/** Shape an EvaluationResult into the public API response (dollars, not cents). */
export function shapeApiResponse(result: EvaluationResult) {
  const d = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : centsToDollars(cents));
  const cons = result.auction.scenarios?.conservative;
  const exp = result.auction.scenarios?.expected;
  const best = result.auction.scenarios?.best;
  return {
    evaluationId: result.evaluationId,
    status: "complete" as const,
    demo: result.demo,
    product: {
      title: result.listing.title,
      brand: result.listing.brand,
      model: result.listing.model,
      condition: result.listing.condition,
      identityConfidence: result.listing.identityConfidence,
    },
    macBid: {
      currentBid: d(result.listing.currentBidCents),
      instantWinPrice: d(result.listing.instantWinCents),
      protectionPrice: d(result.listing.protectionCents),
      protectionEnabled: result.listing.protectionEnabled,
      currentAllInCost: d(result.auction.acquisition?.totalCents ?? null),
      instantWinAllInCost: d(result.instantWin.acquisition?.totalCents ?? null),
    },
    resale: {
      quickSalePrice: d(result.research.stats.quickSaleCents),
      expectedPrice: d(result.research.stats.expectedCents),
      patientPrice: d(result.research.stats.patientCents),
      researchConfidence: result.research.stats.marketConfidence,
      evidenceGrade: result.research.stats.evidenceGrade,
      provisional: result.research.stats.provisional,
    },
    shipping: {
      buyerPaidCharge: d(result.shipping.buyerChargeCents),
      estimatedLabelCost: d(result.shipping.expectedLabelCents),
      conservativeLabelCost: d(result.shipping.conservativeLabelCents),
      packagingCost: d(result.shipping.packagingCents),
      confidence: result.shipping.confidence,
      band: result.shipping.band,
    },
    profitability: {
      conservativeNetProfit: d(cons?.netProfitCents),
      expectedNetProfit: d(exp?.netProfitCents),
      bestReasonableNetProfit: d(best?.netProfitCents),
      conservativeRoi: cons?.acquisitionRoi ?? null,
      expectedRoi: exp?.acquisitionRoi ?? null,
    },
    recommendation: {
      verdict: result.headlineVerdict,
      detail: result.headlineDetail,
      maximumBid: d(result.maxBid.recommendedMaxBidCents),
      maximumProtectedBid: d(result.maxBid.maxProtectedBidCents),
      maximumInstantWinPrice: d(result.maxBid.maxInstantWinCents),
      instantWinVerdict: result.instantWin.verdict,
    },
    velocity: {
      score: result.velocity.score,
      label: result.velocity.label,
      confidence: result.velocity.lowConfidence ? 0.35 : 0.7,
    },
    risks: result.risk.flags.map((f) => ({ key: f.key, label: f.label, level: f.level, detail: f.detail })),
    assumptions: result.assumptions.map((a) => ({ key: a.key, label: a.label, value: a.value, source: a.source })),
    sources: result.research.sources,
    explanation: result.explanation,
  };
}
