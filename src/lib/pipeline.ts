import { dollarsToCents } from "@/lib/money";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { MarketResearch, ProductIdentity, ShippingResearch } from "@/lib/ai/schemas/research";
import { applyHardExclusions, computeMarketStats } from "@/lib/calculations/market";
import { estimateShipping } from "@/lib/calculations/shipping";
import { ericStandardProfile } from "@/lib/profile";
import { evaluate, type EvaluateInput } from "@/lib/calculations/evaluate";
import type {
  EvaluationResult,
  ListingFacts,
  MarketComparable,
  ResearchResult,
  ShippingEstimate,
  SourcingProfile,
} from "@/types/domain";

/** User-editable overrides applied on the review screen or results screen. */
export interface ListingOverrides {
  title?: string;
  brand?: string | null;
  model?: string | null;
  condition?: ListingFacts["condition"];
  currentBid?: number | null; // dollars
  instantWin?: number | null;
  retailPrice?: number | null;
  protectionPrice?: number | null;
  protectionEnabled?: boolean;
  pickupLocation?: string | null;
  displayedTotal?: number | null;
  useDisplayedTotal?: boolean;
}

export function extractionToListingFacts(
  extraction: MacBidScreenshotExtraction,
  identity: ProductIdentity | null,
  overrides: ListingOverrides = {},
): ListingFacts {
  const p = extraction.product;
  const currentBidDollars = overrides.currentBid ?? extraction.auction.currentBid.value ?? 0;
  const instantWinDollars =
    overrides.instantWin !== undefined ? overrides.instantWin : extraction.instantWin.price.value;
  const retailDollars =
    overrides.retailPrice !== undefined ? overrides.retailPrice : extraction.macBid.displayedRetailPrice.value;
  const protectionDollars =
    overrides.protectionPrice !== undefined ? overrides.protectionPrice : extraction.protection.price.value;
  const displayedTotalDollars =
    overrides.displayedTotal !== undefined ? overrides.displayedTotal : extraction.macBid.displayedAllInTotal.value;

  return {
    title: overrides.title ?? p.title.value ?? "Unknown product",
    brand: overrides.brand !== undefined ? overrides.brand : p.brand.value,
    model: overrides.model !== undefined ? overrides.model : (p.modelNumber.value ?? p.mpn.value),
    condition: overrides.condition ?? p.condition.value ?? "unknown",
    currentBidCents: dollarsToCents(currentBidDollars),
    instantWinCents: instantWinDollars === null ? null : dollarsToCents(instantWinDollars),
    retailPriceCents: retailDollars === null ? null : dollarsToCents(retailDollars),
    protectionCents: protectionDollars === null ? null : dollarsToCents(protectionDollars),
    protectionEnabled:
      overrides.protectionEnabled ?? extraction.protection.enabledInScreenshot.value ?? false,
    displayedAllInTotalCents: displayedTotalDollars === null ? null : dollarsToCents(displayedTotalDollars),
    useDisplayedTotal: overrides.useDisplayedTotal ?? false,
    pickupLocation:
      overrides.pickupLocation !== undefined ? overrides.pickupLocation : extraction.macBid.pickupLocation.value,
    auctionTimeText: extraction.auction.timeRemainingText.value,
    instantWinTimeText: extraction.instantWin.timeRemainingText.value,
    possiblyMissingItems: p.possiblyMissingItems,
    identityConfidence: identity?.identityConfidence ?? Math.min(0.6, p.title.confidence),
    identityMatch: identity?.matchLevel ?? "possible_match",
  };
}

export function marketToResearchResult(market: MarketResearch, demo: boolean): ResearchResult {
  const comparables: MarketComparable[] = market.comparables.map((c) => ({
    sourceTitle: c.sourceTitle,
    sourceUrl: c.sourceUrl,
    priceCents: c.price === null ? null : dollarsToCents(c.price),
    shippingCents: c.shippingPrice === null ? null : dollarsToCents(c.shippingPrice),
    condition: c.condition,
    dateText: c.dateText,
    soldStatus: c.soldStatus,
    exactModelMatch: c.exactModelMatch,
    accessoryMatch: c.accessoryMatch,
    quantityMatch: c.quantityMatch,
    relevanceScore: c.relevanceScore,
    accepted: c.exclusionReason === null,
    exclusionReason: c.exclusionReason,
  }));

  const verifiedRetailCents = market.verifiedRetailPrice === null ? null : dollarsToCents(market.verifiedRetailPrice);
  const stats = computeMarketStats({
    comparables,
    verifiedRetailCents,
    activeCompetitionCount: market.activeCompetitionEstimate,
  });
  return {
    // Apply the same hard-exclusion rules the stats used, so the display
    // matches what actually fed the numbers.
    comparables: comparables.map(applyHardExclusions),
    stats,
    verifiedRetailCents,
    sources: market.sources.map((s) => ({ title: s.title, url: s.url, kind: s.kind, note: s.note ?? undefined })),
    demo,
  };
}

export function shippingResearchToEstimate(
  research: ShippingResearch | null,
  overrides?: Parameters<typeof estimateShipping>[0]["overrides"],
): ShippingEstimate {
  return estimateShipping({
    itemWeightOz: research?.itemWeightOz ?? null,
    packedWeightOz: research?.packedWeightOz ?? null,
    packageDimensionsIn: research?.packageDimensionsIn ?? null,
    source: research ? research.source : "category_default",
    confidence: research?.confidence,
    overrides,
  });
}

export interface FullEvaluationArgs {
  evaluationId: string;
  demo: boolean;
  listing: ListingFacts;
  research: ResearchResult;
  shipping: ShippingEstimate;
  profile: SourcingProfile;
  categoryGuess?: string | null;
  brandRecognized?: boolean;
  seasonal?: boolean;
  researchFailed?: boolean;
  explanation?: string | null;
  createdAt?: string;
}

export function runEvaluation(args: FullEvaluationArgs): EvaluationResult {
  const input: EvaluateInput = { ...args };
  return evaluate(input);
}

/* ------------------------- assembly & recalculation ------------------------- */

/** Deep-ish merge of a partial profile onto the Eric Standard defaults. */
export function mergeProfile(partial: unknown): SourcingProfile {
  const base = ericStandardProfile();
  if (!partial || typeof partial !== "object") return base;
  const p = partial as Record<string, unknown>;
  return {
    ...base,
    ...(typeof p.name === "string" ? { name: p.name } : {}),
    ...(typeof p.originZip === "string" ? { originZip: p.originZip } : {}),
    ...(typeof p.conservativeDestinationZip === "string"
      ? { conservativeDestinationZip: p.conservativeDestinationZip }
      : {}),
    macBid: { ...base.macBid, ...(p.macBid as object | undefined) },
    ebay: { ...base.ebay, ...(p.ebay as object | undefined) },
    thresholds: { ...base.thresholds, ...(p.thresholds as object | undefined) },
  };
}

export interface AssembleArgs {
  evaluationId?: string;
  extraction: MacBidScreenshotExtraction;
  identity: ProductIdentity | null;
  market: MarketResearch | null;
  shipping: ShippingResearch | null;
  profile: SourcingProfile;
  overrides?: ListingOverrides;
  shippingOverrides?: Parameters<typeof shippingResearchToEstimate>[1];
  demo: boolean;
  researchFailed?: boolean;
  explanation?: string | null;
  createdAt?: string;
}

/** Deterministic assembly: AI outputs in, EvaluationResult out. No AI calls. */
export function assembleEvaluation(args: AssembleArgs): EvaluationResult {
  const listing = extractionToListingFacts(args.extraction, args.identity, args.overrides ?? {});
  const research = args.market
    ? marketToResearchResult(args.market, args.demo)
    : marketToResearchResult(
        {
          comparables: [],
          verifiedRetailPrice: null,
          activeCompetitionEstimate: null,
          brandRecognized: null,
          seasonal: null,
          categoryGuess: null,
          sources: [],
          notes: [],
        },
        args.demo,
      );
  const shipping = shippingResearchToEstimate(args.shipping, args.shippingOverrides);

  return runEvaluation({
    evaluationId: args.evaluationId ?? globalThis.crypto.randomUUID(),
    demo: args.demo,
    listing,
    research,
    shipping,
    profile: args.profile,
    categoryGuess: args.market?.categoryGuess ?? args.extraction.product.categoryGuess.value,
    brandRecognized: args.market?.brandRecognized ?? undefined,
    seasonal: args.market?.seasonal ?? undefined,
    researchFailed: args.researchFailed ?? false,
    explanation: args.explanation ?? null,
    createdAt: args.createdAt,
  });
}

/**
 * Instant client-side recalculation: apply edited assumptions to an existing
 * EvaluationResult and re-run the deterministic calculators. No AI calls.
 */
export function reevaluate(
  result: EvaluationResult,
  changes: {
    listing?: Partial<ListingFacts>;
    profile?: SourcingProfile;
    shipping?: Partial<ShippingEstimate>;
    /** Direct overrides of the resale price statistics (user-edited). */
    stats?: Partial<ResearchResult["stats"]>;
  },
): EvaluationResult {
  const research: ResearchResult = changes.stats
    ? { ...result.research, stats: { ...result.research.stats, ...changes.stats } }
    : result.research;
  return runEvaluation({
    evaluationId: result.evaluationId,
    createdAt: result.createdAt,
    demo: result.demo,
    listing: { ...result.listing, ...changes.listing },
    research,
    shipping: { ...result.shipping, ...changes.shipping },
    profile: changes.profile ?? result.profile,
    explanation: result.explanation,
  });
}
