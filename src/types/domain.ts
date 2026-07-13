/**
 * Core domain types shared by the calculation engine, AI layer, UI and API.
 * All money values are integer cents (see src/lib/money.ts). All rates are
 * decimal fractions (0.15 = 15%).
 */
import type { Cents } from "@/lib/money";

/* ---------------------------------- shared --------------------------------- */

export type ConfidenceValue<T> = {
  value: T | null;
  /** 0..1 */
  confidence: number;
  sourceText?: string | null;
};

export type ItemCondition =
  | "new"
  | "like_new"
  | "open_box"
  | "used"
  | "damaged"
  | "parts_only"
  | "unknown";

export type EvidenceGrade =
  | "strong_sold" // A
  | "partial_sold" // B
  | "active_only" // C
  | "insufficient"; // D

export type IdentityMatchLevel =
  | "exact_match"
  | "probable_match"
  | "possible_match"
  | "ambiguous"
  | "no_reliable_match";

export type Verdict =
  | "strong_buy"
  | "buy_below"
  | "borderline"
  | "pass"
  | "insufficient_evidence"
  | "confirm_product";

export type RiskLevel = "low" | "moderate" | "high" | "very_high";

export type VelocityLabel =
  | "very_fast"
  | "fast"
  | "moderate"
  | "slow"
  | "dead_inventory_risk";

/* ------------------------------ sourcing profile ---------------------------- */

export interface MacBidFeeProfile {
  /** e.g. 0.15 */
  buyerPremiumRate: number;
  lotFeeCents: Cents;
  /** e.g. 0.06 */
  salesTaxRate: number;
  transferFeeCents: Cents;
  /** Which components are included in the sales-tax base. */
  taxableBase: {
    hammerBid: boolean;
    buyerPremium: boolean;
    lotFee: boolean;
    protection: boolean;
    transferFee: boolean;
  };
}

export interface EbayFeeProfile {
  /** "none" is the only supported store level in v1. */
  storeSubscription: "none";
  /** Category label used to pick the final-value-fee rate. */
  category: string;
  /** Final value fee rate applied to item price + buyer-paid shipping. */
  finalValueFeeRate: number;
  /** True when finalValueFeeRate came from the fallback, not a known category. */
  isFallbackRate: boolean;
  perOrderFeeCents: Cents;
  /** Selected promoted-listings rate (0, 0.02, 0.05 or custom). */
  promotionRate: number;
  /** Extra safety margin added on top of computed fees. */
  feeBufferRate: number;
  /** International fee rate; 0 for domestic-only v1. */
  internationalFeeRate: number;
}

export interface ProfitabilityThresholds {
  minNetProfitCents: Cents;
  /** 0.75 */
  minExpectedRoi: number;
  /** 0.50 */
  minConservativeRoi: number;
  /** Optional absolute cap on any recommended bid; null = no cap. */
  absoluteMaxBidCents: Cents | null;
  /** Round recommended bids down to whole dollars. */
  roundBidsToWholeDollars: boolean;
}

export interface SourcingProfile {
  name: string;
  originZip: string;
  conservativeDestinationZip: string;
  macBid: MacBidFeeProfile;
  ebay: EbayFeeProfile;
  thresholds: ProfitabilityThresholds;
  /** Fallback FVF rate used when the category is uncertain. */
  fallbackFinalValueFeeRate: number;
}

/* ------------------------------- listing input ------------------------------ */

/** Normalized, user-confirmed listing facts that feed the calculators. */
export interface ListingFacts {
  title: string;
  brand: string | null;
  model: string | null;
  condition: ItemCondition;
  currentBidCents: Cents;
  instantWinCents: Cents | null;
  retailPriceCents: Cents | null;
  protectionCents: Cents | null;
  protectionEnabled: boolean;
  displayedAllInTotalCents: Cents | null;
  /** When true and a displayed total exists, it overrides the calculated total. */
  useDisplayedTotal: boolean;
  pickupLocation: string | null;
  auctionTimeText: string | null;
  instantWinTimeText: string | null;
  possiblyMissingItems: string[];
  identityConfidence: number;
  identityMatch: IdentityMatchLevel;
}

/* ------------------------------ market research ----------------------------- */

export type SoldStatus = "sold" | "active" | "unknown";

export interface MarketComparable {
  sourceTitle: string;
  sourceUrl: string | null;
  priceCents: Cents | null;
  shippingCents: Cents | null;
  condition: string | null;
  dateText: string | null;
  soldStatus: SoldStatus;
  exactModelMatch: boolean;
  accessoryMatch: boolean;
  quantityMatch: boolean;
  /** 0..1 */
  relevanceScore: number;
  accepted: boolean;
  exclusionReason: string | null;
}

export interface MarketStats {
  acceptedCompCount: number;
  soldCompCount: number;
  medianCents: Cents | null;
  meanCents: Cents | null;
  p25Cents: Cents | null;
  p75Cents: Cents | null;
  lowerAdjustedCents: Cents | null;
  upperAdjustedCents: Cents | null;
  quickSaleCents: Cents | null;
  expectedCents: Cents | null;
  patientCents: Cents | null;
  activeCompetitionCount: number | null;
  evidenceGrade: EvidenceGrade;
  /** 0..1 */
  marketConfidence: number;
  provisional: boolean;
  notes: string[];
}

export interface ResearchResult {
  comparables: MarketComparable[];
  stats: MarketStats;
  /** Verified current retail price when found. */
  verifiedRetailCents: Cents | null;
  sources: EvidenceSource[];
  /** True when produced by demo mode, not live research. */
  demo: boolean;
}

export interface EvidenceSource {
  title: string;
  url: string | null;
  kind: "sold_listing" | "active_listing" | "retailer" | "manufacturer" | "other";
  note?: string;
}

/* --------------------------------- shipping --------------------------------- */

export type ShippingBand =
  | "small_lightweight"
  | "small_dense"
  | "medium"
  | "large"
  | "oversized"
  | "freight_like";

export interface ShippingEstimate {
  band: ShippingBand;
  itemWeightOz: number | null;
  packedWeightOz: number;
  packageDimensionsIn: { l: number; w: number; h: number } | null;
  dimensionalWeightRisk: boolean;
  suggestedService: string;
  buyerChargeCents: Cents;
  expectedLabelCents: Cents;
  conservativeLabelCents: Cents;
  packagingCents: Cents;
  /** 0..1 */
  confidence: number;
  source:
    | "manufacturer_spec"
    | "product_spec"
    | "comparable_listing"
    | "category_default"
    | "manual_override";
  destinationZip: string;
  assumptions: string[];
}

/* ------------------------------ cost & scenarios ---------------------------- */

export interface AcquisitionBreakdown {
  hammerBidCents: Cents;
  buyerPremiumCents: Cents;
  lotFeeCents: Cents;
  protectionCents: Cents;
  transferFeeCents: Cents;
  salesTaxCents: Cents;
  totalCents: Cents;
  /** Screenshot-displayed total, when present. */
  displayedTotalCents: Cents | null;
  /** Absolute difference between displayed and calculated total. */
  discrepancyCents: Cents | null;
  discrepancyWarning: boolean;
  usedDisplayedTotal: boolean;
}

export interface SellingExpenseBreakdown {
  finalValueFeeCents: Cents;
  perOrderFeeCents: Cents;
  promotedListingFeeCents: Cents;
  feeBufferCents: Cents;
  shippingLabelCents: Cents;
  packagingCents: Cents;
  returnRiskReserveCents: Cents;
  accessoryAllowanceCents: Cents;
  totalCents: Cents;
}

export interface ScenarioResult {
  name: "conservative" | "expected" | "best";
  salePriceCents: Cents;
  buyerShippingCents: Cents;
  transactionRevenueCents: Cents;
  expenses: SellingExpenseBreakdown;
  acquisitionTotalCents: Cents;
  netProfitCents: Cents;
  /** netProfit / acquisitionTotal */
  acquisitionRoi: number | null;
  /** netProfit / (acquisitionTotal + label + packaging) */
  totalCashRoi: number | null;
}

export interface MaxBidResult {
  profitCeilingCents: Cents | null;
  roiCeilingCents: Cents | null;
  recommendedMaxBidCents: Cents | null;
  maxProtectedBidCents: Cents | null;
  maxInstantWinCents: Cents | null;
  bidRoomCents: Cents | null;
  cappedByProfile: boolean;
}

export interface RiskFlag {
  key: string;
  label: string;
  level: RiskLevel;
  detail: string;
}

export interface RiskAssessment {
  flags: RiskFlag[];
  overall: RiskLevel;
}

export interface VelocityFactor {
  key: string;
  label: string;
  weight: number;
  /** 0..1 subscore */
  score: number;
  note: string;
}

export interface VelocityResult {
  score: number;
  label: VelocityLabel;
  lowConfidence: boolean;
  factors: VelocityFactor[];
}

export interface ChannelEvaluation {
  channel: "auction" | "instant_win";
  applicable: boolean;
  acquisition: AcquisitionBreakdown | null;
  scenarios: { conservative: ScenarioResult; expected: ScenarioResult; best: ScenarioResult } | null;
  verdict: Verdict;
  verdictDetail: string;
  buyBelowCents: Cents | null;
  requiredResaleForMinProfitCents: Cents | null;
}

export interface Assumption {
  key: string;
  label: string;
  value: string;
  editable: boolean;
  source: "profile" | "screenshot" | "research" | "default" | "user";
}

export interface EvaluationResult {
  evaluationId: string;
  createdAt: string;
  demo: boolean;
  listing: ListingFacts;
  research: ResearchResult;
  shipping: ShippingEstimate;
  profile: SourcingProfile;
  auction: ChannelEvaluation;
  instantWin: ChannelEvaluation;
  maxBid: MaxBidResult;
  velocity: VelocityResult;
  risk: RiskAssessment;
  assumptions: Assumption[];
  /** Verdict shown at the top (auction channel unless only IW applies). */
  headlineVerdict: Verdict;
  headlineDetail: string;
  explanation: string | null;
  promotionScenarios: { rate: number; conservativeNetCents: Cents; expectedNetCents: Cents }[];
}
