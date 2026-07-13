import { formatCents, type Cents } from "@/lib/money";
import type {
  EvidenceGrade,
  ProfitabilityThresholds,
  RiskLevel,
  ScenarioResult,
  Verdict,
  VelocityResult,
} from "@/types/domain";

export interface VerdictInput {
  channel: "auction" | "instant_win";
  identityConfidence: number;
  evidenceGrade: EvidenceGrade;
  conservative: ScenarioResult;
  expected: ScenarioResult;
  thresholds: ProfitabilityThresholds;
  velocity: VelocityResult;
  overallRisk: RiskLevel;
  /** Auction: current bid. Instant Win: the fixed price. */
  currentPriceCents: Cents;
  /** Auction: recommended max bid. Instant Win: max IW acquisition price. */
  maxPriceCents: Cents | null;
  criticalValuesMissing: boolean;
  researchFailed: boolean;
}

export interface VerdictOutput {
  verdict: Verdict;
  detail: string;
  buyBelowCents: Cents | null;
}

const IDENTITY_CONFIRM_THRESHOLD = 0.7;

/**
 * Deterministic verdict engine. The conservative scenario controls the
 * outcome; a low-confidence evaluation can never return Strong Buy.
 */
export function decideVerdict(input: VerdictInput): VerdictOutput {
  const t = input.thresholds;
  const cons = input.conservative;
  const exp = input.expected;

  if (input.researchFailed || input.evidenceGrade === "insufficient" || input.criticalValuesMissing) {
    return {
      verdict: "insufficient_evidence",
      detail: input.researchFailed
        ? "Market research failed or was unavailable — no defensible resale estimate."
        : input.criticalValuesMissing
          ? "Critical listing values are missing — fill them in and recalculate."
          : "Not enough market evidence to support a recommendation.",
      buyBelowCents: null,
    };
  }

  if (input.identityConfidence < IDENTITY_CONFIRM_THRESHOLD) {
    return {
      verdict: "confirm_product",
      detail: `Product identity confidence is ${(input.identityConfidence * 100).toFixed(0)}% (< 70%). Confirm the exact product before trusting any number here.`,
      buyBelowCents: null,
    };
  }

  const consRoiOk =
    cons.acquisitionRoi === null ? cons.netProfitCents >= 0 : cons.acquisitionRoi >= t.minConservativeRoi;
  const expRoiOk =
    exp.acquisitionRoi === null ? exp.netProfitCents >= 0 : exp.acquisitionRoi >= t.minExpectedRoi;
  const profitOk = cons.netProfitCents >= t.minNetProfitCents;
  const mathPasses = profitOk && consRoiOk && expRoiOk;

  const max = input.maxPriceCents;
  const priceAboveMax = max === null || input.currentPriceCents > max;

  if (!mathPasses || priceAboveMax) {
    const reasons: string[] = [];
    if (!profitOk)
      reasons.push(
        `conservative net ${formatCents(cons.netProfitCents)} is below the ${formatCents(t.minNetProfitCents)} floor`,
      );
    if (!consRoiOk)
      reasons.push(
        `conservative ROI ${cons.acquisitionRoi === null ? "n/a" : (cons.acquisitionRoi * 100).toFixed(0) + "%"} is below ${(t.minConservativeRoi * 100).toFixed(0)}%`,
      );
    if (!expRoiOk)
      reasons.push(
        `expected ROI ${exp.acquisitionRoi === null ? "n/a" : (exp.acquisitionRoi * 100).toFixed(0) + "%"} is below ${(t.minExpectedRoi * 100).toFixed(0)}%`,
      );
    if (priceAboveMax)
      reasons.push(
        max === null
          ? "no price clears the thresholds"
          : `${input.channel === "auction" ? "current bid" : "Instant Win price"} ${formatCents(input.currentPriceCents)} exceeds the ${formatCents(max)} ceiling`,
      );
    return {
      verdict: "pass",
      detail: `Fails at the current price: ${reasons.join("; ")}.`,
      buyBelowCents: max,
    };
  }

  // Math passes at the current price and the price is at or below the ceiling.
  const strongEvidence = input.evidenceGrade === "strong_sold" || input.evidenceGrade === "partial_sold";
  const velocityOk = input.velocity.score >= 60;
  const bidRoom = max !== null ? max - input.currentPriceCents : 0;
  const materialRoom = max !== null && bidRoom >= Math.max(500, Math.round(max * 0.25));
  const nearCeiling = max !== null && bidRoom <= Math.max(200, Math.round(max * 0.1));
  const highRisk = input.overallRisk === "high" || input.overallRisk === "very_high";
  const highConfidenceIdentity = input.identityConfidence >= 0.85;

  const marginThin =
    cons.netProfitCents < t.minNetProfitCents + 500 ||
    (cons.acquisitionRoi !== null && cons.acquisitionRoi < t.minConservativeRoi + 0.1);

  if (
    highConfidenceIdentity &&
    input.evidenceGrade === "strong_sold" &&
    velocityOk &&
    materialRoom &&
    !highRisk &&
    !marginThin
  ) {
    return {
      verdict: "strong_buy",
      detail: `Strong sold evidence, ${formatCents(bidRoom)} of bid room, and conservative math clears every floor.`,
      buyBelowCents: max,
    };
  }

  if (nearCeiling || marginThin || highRisk || input.velocity.score < 60 || !strongEvidence) {
    const why: string[] = [];
    if (nearCeiling) why.push("current price is close to the maximum");
    if (marginThin) why.push("the math barely clears the floors");
    if (highRisk) why.push("meaningful unresolved risk");
    if (input.velocity.score < 60) why.push("slow expected cash velocity");
    if (!strongEvidence) why.push("evidence is active-market only");
    return {
      verdict: "borderline",
      detail: `Passes, but ${why.join("; ")}.`,
      buyBelowCents: max,
    };
  }

  return {
    verdict: "buy_below",
    detail: `Profitable up to ${formatCents(max!)} all thresholds hold at or below that ${input.channel === "auction" ? "bid" : "price"}.`,
    buyBelowCents: max,
  };
}
