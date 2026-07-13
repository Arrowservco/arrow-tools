import { formatCents, formatRate, type Cents } from "@/lib/money";
import { calculateAcquisition } from "@/lib/calculations/macbid";
import { computeScenarioSet } from "@/lib/calculations/profitability";
import { calculateMaxBids } from "@/lib/calculations/maximumBid";
import { calculateVelocity } from "@/lib/calculations/velocity";
import { assessRisk } from "@/lib/calculations/risk";
import { decideVerdict } from "@/lib/calculations/verdict";
import type {
  Assumption,
  ChannelEvaluation,
  EvaluationResult,
  ListingFacts,
  ResearchResult,
  ShippingEstimate,
  SourcingProfile,
  Verdict,
} from "@/types/domain";

export interface EvaluateInput {
  evaluationId: string;
  createdAt?: string;
  demo: boolean;
  listing: ListingFacts;
  research: ResearchResult;
  shipping: ShippingEstimate;
  profile: SourcingProfile;
  categoryGuess?: string | null;
  brandRecognized?: boolean;
  seasonal?: boolean;
  hardToTest?: boolean;
  compatibilityRisk?: boolean;
  researchFailed?: boolean;
  explanation?: string | null;
}

const WELL_KNOWN_BRANDS = /dewalt|milwaukee|makita|bosch|ryobi|zircon|dyson|apple|samsung|sony|lg|ninja|keurig|kitchenaid|lego|craftsman|ridgid|shark|bissell|irobot|greenworks|ego|hart|black\+?decker|stanley|klein|honeywell|nest|ring|anker|jbl|logitech/i;

/**
 * The single deterministic evaluation pipeline. Everything here is pure
 * TypeScript — no AI in the loop — so assumptions can be edited and results
 * recalculated instantly.
 */
export function evaluate(input: EvaluateInput): EvaluationResult {
  const { listing, research, shipping, profile } = input;
  const stats = research.stats;
  const protectionCents = listing.protectionEnabled ? (listing.protectionCents ?? 0) : 0;

  const criticalValuesMissing =
    stats.quickSaleCents === null || stats.expectedCents === null || stats.patientCents === null;

  // Safe placeholders keep the pipeline total when research came up empty;
  // the verdict engine returns insufficient_evidence in that case.
  const quick = stats.quickSaleCents ?? 0;
  const expected = stats.expectedCents ?? 0;
  const patient = stats.patientCents ?? 0;

  const accessoryUncertain =
    listing.possiblyMissingItems.length > 0 ||
    (listing.condition !== "new" && listing.condition !== "like_new");

  const scenarioBase = {
    quickSaleCents: quick,
    expectedCents: expected,
    patientCents: patient,
    shipping,
    condition: listing.condition,
    accessoryUncertain,
    ebay: profile.ebay,
  };

  // ---------- Auction channel ----------
  const auctionAcq = calculateAcquisition({
    hammerBidCents: listing.currentBidCents,
    protectionCents,
    fees: profile.macBid,
    displayedTotalCents: listing.displayedAllInTotalCents,
    useDisplayedTotal: listing.useDisplayedTotal,
  });
  const auctionScenarios = computeScenarioSet({ ...scenarioBase, acquisition: auctionAcq });

  const maxBid = calculateMaxBids({
    macBidFees: profile.macBid,
    protectionCents: listing.protectionCents ?? 0,
    protectionEnabled: listing.protectionEnabled,
    thresholds: profile.thresholds,
    scenarioBase,
    currentBidCents: listing.currentBidCents,
    instantWinCents: listing.instantWinCents,
  });

  const brandRecognized =
    input.brandRecognized ?? WELL_KNOWN_BRANDS.test(`${listing.brand ?? ""} ${listing.title}`);

  const velocity = calculateVelocity({
    stats,
    condition: listing.condition,
    shipping,
    brandRecognized,
    seasonal: input.seasonal ?? false,
    hardToTest: input.hardToTest ?? false,
    compatibilityRisk: input.compatibilityRisk ?? false,
    cashTiedUpCents: auctionScenarios.expected.acquisitionTotalCents,
  });

  const risk = assessRisk({
    listing,
    stats,
    shipping,
    categoryGuess: input.categoryGuess ?? null,
  });

  const auctionVerdict = decideVerdict({
    channel: "auction",
    identityConfidence: listing.identityConfidence,
    evidenceGrade: stats.evidenceGrade,
    conservative: auctionScenarios.conservative,
    expected: auctionScenarios.expected,
    thresholds: profile.thresholds,
    velocity,
    overallRisk: risk.overall,
    currentPriceCents: listing.currentBidCents,
    maxPriceCents: maxBid.recommendedMaxBidCents,
    criticalValuesMissing,
    researchFailed: input.researchFailed ?? false,
  });

  const auction: ChannelEvaluation = {
    channel: "auction",
    applicable: true,
    acquisition: auctionAcq,
    scenarios: auctionScenarios,
    verdict: auctionVerdict.verdict,
    verdictDetail: auctionVerdict.detail,
    buyBelowCents: auctionVerdict.buyBelowCents,
    requiredResaleForMinProfitCents: requiredResaleForMinProfit(input, auctionAcq.totalCents),
  };

  // ---------- Instant Win channel ----------
  let instantWin: ChannelEvaluation;
  if (listing.instantWinCents === null) {
    instantWin = {
      channel: "instant_win",
      applicable: false,
      acquisition: null,
      scenarios: null,
      verdict: "insufficient_evidence" as Verdict,
      verdictDetail: "No Instant Win offer visible on this listing.",
      buyBelowCents: null,
      requiredResaleForMinProfitCents: null,
    };
  } else {
    const iwAcq = calculateAcquisition({
      hammerBidCents: listing.instantWinCents,
      protectionCents,
      fees: profile.macBid,
    });
    const iwScenarios = computeScenarioSet({ ...scenarioBase, acquisition: iwAcq });
    const iwVerdict = decideVerdict({
      channel: "instant_win",
      identityConfidence: listing.identityConfidence,
      evidenceGrade: stats.evidenceGrade,
      conservative: iwScenarios.conservative,
      expected: iwScenarios.expected,
      thresholds: profile.thresholds,
      velocity,
      overallRisk: risk.overall,
      currentPriceCents: listing.instantWinCents,
      maxPriceCents: maxBid.maxInstantWinCents,
      criticalValuesMissing,
      researchFailed: input.researchFailed ?? false,
    });
    instantWin = {
      channel: "instant_win",
      applicable: true,
      acquisition: iwAcq,
      scenarios: iwScenarios,
      verdict: iwVerdict.verdict,
      verdictDetail: iwVerdict.detail,
      buyBelowCents: iwVerdict.buyBelowCents,
      requiredResaleForMinProfitCents: requiredResaleForMinProfit(input, iwAcq.totalCents),
    };
  }

  const promotionScenarios = [0, 0.02, 0.05, profile.ebay.promotionRate]
    .filter((r, i, arr) => arr.indexOf(r) === i)
    .sort((a, b) => a - b)
    .map((rate) => {
      const s = computeScenarioSet({
        ...scenarioBase,
        acquisition: auctionAcq,
        promotionRateOverride: rate,
      });
      return {
        rate,
        conservativeNetCents: s.conservative.netProfitCents,
        expectedNetCents: s.expected.netProfitCents,
      };
    });

  const assumptions = buildAssumptions(input, stats.provisional);

  return {
    evaluationId: input.evaluationId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    demo: input.demo,
    listing,
    research,
    shipping,
    profile,
    auction,
    instantWin,
    maxBid,
    velocity,
    risk,
    assumptions,
    headlineVerdict: auction.verdict,
    headlineDetail: auction.verdictDetail,
    explanation: input.explanation ?? null,
    promotionScenarios,
  };
}

/** Sale price needed for the expected scenario to net the profit floor. */
function requiredResaleForMinProfit(input: EvaluateInput, acquisitionTotalCents: Cents): Cents | null {
  const { profile, shipping, listing } = input;
  // Solve: price + buyerShip - fees(price+ship) - fixedCosts - acq = minProfit
  // Fees are linear in (price + ship): rate = fvf + promo (+ buffer approx).
  const rate =
    profile.ebay.finalValueFeeRate +
    profile.ebay.promotionRate +
    profile.ebay.internationalFeeRate;
  if (rate >= 1) return null;
  const buyerShip = shipping.buyerChargeCents;
  const baseReserve = 0.05; // simple planning approximation for this metric
  const fixed =
    profile.ebay.perOrderFeeCents +
    shipping.expectedLabelCents +
    shipping.packagingCents +
    acquisitionTotalCents +
    profile.thresholds.minNetProfitCents;
  void listing;
  const price = (fixed - buyerShip * (1 - rate)) / (1 - rate - baseReserve);
  return price > 0 ? Math.ceil(price) : 0;
}

function buildAssumptions(input: EvaluateInput, provisional: boolean): Assumption[] {
  const { profile, shipping, listing } = input;
  const a: Assumption[] = [
    { key: "premium", label: "Buyer's premium", value: formatRate(profile.macBid.buyerPremiumRate), editable: true, source: "profile" },
    { key: "lot_fee", label: "Lot fee", value: formatCents(profile.macBid.lotFeeCents), editable: true, source: "profile" },
    { key: "tax", label: "PA sales tax", value: formatRate(profile.macBid.salesTaxRate), editable: true, source: "profile" },
    { key: "transfer", label: "Transfer fee (Monroeville)", value: formatCents(profile.macBid.transferFeeCents), editable: true, source: "profile" },
    {
      key: "protection",
      label: "Purchase protection",
      value: listing.protectionEnabled
        ? `On (${formatCents(listing.protectionCents ?? 0)})`
        : `Off${listing.protectionCents !== null ? ` (${formatCents(listing.protectionCents)} available)` : ""}`,
      editable: true,
      source: "screenshot",
    },
    {
      key: "fvf",
      label: profile.ebay.isFallbackRate ? "eBay final value fee (fallback non-Store fee assumption)" : `eBay final value fee (${profile.ebay.category})`,
      value: formatRate(profile.ebay.finalValueFeeRate, 2),
      editable: true,
      source: profile.ebay.isFallbackRate ? "default" : "research",
    },
    { key: "per_order", label: "eBay per-order fee", value: formatCents(profile.ebay.perOrderFeeCents), editable: true, source: "profile" },
    { key: "promo", label: "Promoted listing rate", value: formatRate(profile.ebay.promotionRate), editable: true, source: "profile" },
    { key: "ship_route", label: "Shipping route", value: `${profile.originZip} → ${shipping.destinationZip}`, editable: true, source: "profile" },
    { key: "buyer_ship", label: "Buyer-paid shipping charge", value: formatCents(shipping.buyerChargeCents), editable: true, source: "default" },
    { key: "label", label: "Expected label cost", value: formatCents(shipping.expectedLabelCents), editable: true, source: "default" },
    { key: "label_cons", label: "Conservative label cost", value: formatCents(shipping.conservativeLabelCents), editable: true, source: "default" },
    { key: "packaging", label: "Packaging cost", value: formatCents(shipping.packagingCents), editable: true, source: "default" },
    { key: "profit_floor", label: "Minimum net profit", value: formatCents(profile.thresholds.minNetProfitCents), editable: true, source: "profile" },
    { key: "roi_floor", label: "ROI floors (expected / conservative)", value: `${formatRate(profile.thresholds.minExpectedRoi)} / ${formatRate(profile.thresholds.minConservativeRoi)}`, editable: true, source: "profile" },
  ];
  if (provisional) {
    a.push({
      key: "provisional",
      label: "Resale estimate",
      value: "PROVISIONAL — weak sold evidence, conservative fallback applied",
      editable: false,
      source: "research",
    });
  }
  if (input.demo) {
    a.push({ key: "demo", label: "Data source", value: "Demo data, not live market evidence", editable: false, source: "default" });
  }
  return a;
}

/**
 * Cheap preliminary screen before spending research calls: could this listing
 * plausibly clear the profit floor even if it resold at full displayed retail?
 */
export function preliminaryScreen(args: {
  priceCents: Cents;
  retailCents: Cents | null;
  profile: SourcingProfile;
  protectionCents?: Cents;
}): { worthResearching: boolean; note: string } {
  const acq = calculateAcquisition({
    hammerBidCents: args.priceCents,
    protectionCents: args.protectionCents ?? 0,
    fees: args.profile.macBid,
  });
  if (args.retailCents === null) {
    return { worthResearching: true, note: "No retail anchor — research required." };
  }
  // Optimistic ceiling: resale at 90% of retail, ~25% total selling costs.
  const optimisticNet = Math.round(args.retailCents * 0.9 * 0.75) - acq.totalCents;
  if (optimisticNet < args.profile.thresholds.minNetProfitCents) {
    return {
      worthResearching: false,
      note: `Even at 90% of retail the net (~${formatCents(optimisticNet)}) misses the ${formatCents(
        args.profile.thresholds.minNetProfitCents,
      )} floor. Preliminary pass.`,
    };
  }
  return { worthResearching: true, note: "Preliminary math passes — worth researching." };
}
