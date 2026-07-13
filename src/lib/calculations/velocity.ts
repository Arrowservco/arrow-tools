import { clamp } from "@/lib/money";
import type {
  ItemCondition,
  MarketStats,
  ShippingEstimate,
  VelocityFactor,
  VelocityLabel,
  VelocityResult,
} from "@/types/domain";

export interface VelocityInput {
  stats: MarketStats;
  condition: ItemCondition;
  shipping: ShippingEstimate;
  brandRecognized: boolean;
  seasonal: boolean;
  hardToTest: boolean;
  compatibilityRisk: boolean;
  cashTiedUpCents: number;
}

export function velocityLabel(score: number): VelocityLabel {
  if (score >= 90) return "very_fast";
  if (score >= 75) return "fast";
  if (score >= 60) return "moderate";
  if (score >= 40) return "slow";
  return "dead_inventory_risk";
}

const CONDITION_SCORE: Record<ItemCondition, number> = {
  new: 1,
  like_new: 0.9,
  open_box: 0.8,
  used: 0.55,
  damaged: 0.25,
  parts_only: 0.15,
  unknown: 0.45,
};

/**
 * Transparent weighted Cash Velocity Score (0–100). Weights sum to 100.
 * Every factor and its contribution is shown to the user.
 */
export function calculateVelocity(input: VelocityInput): VelocityResult {
  const { stats } = input;
  const sold = stats.soldCompCount;
  const comps = stats.acceptedCompCount;

  const spread =
    stats.p25Cents !== null && stats.p75Cents !== null && stats.medianCents && stats.medianCents > 0
      ? (stats.p75Cents - stats.p25Cents) / stats.medianCents
      : 1;

  const competition = stats.activeCompetitionCount;

  const factors: VelocityFactor[] = [
    {
      key: "sold_evidence",
      label: "Sold-evidence count",
      weight: 20,
      score: clamp(sold / 6, 0, 1),
      note: `${sold} sold comparable(s) accepted`,
    },
    {
      key: "recency",
      label: "Evidence recency",
      weight: 10,
      score: stats.evidenceGrade === "strong_sold" ? 0.9 : stats.evidenceGrade === "partial_sold" ? 0.6 : 0.3,
      note: `Evidence grade: ${stats.evidenceGrade}`,
    },
    {
      key: "sales_frequency",
      label: "Estimated sales frequency",
      weight: 10,
      score: clamp(comps / 8, 0, 1),
      note: `${comps} accepted comparable(s) overall`,
    },
    {
      key: "competition",
      label: "Active competition",
      weight: 10,
      score: competition === null ? 0.5 : clamp(1 - competition / 40, 0, 1),
      note:
        competition === null
          ? "Active listing count unknown (neutral 0.5)"
          : `≈${competition} active competing listings`,
    },
    {
      key: "brand",
      label: "Brand recognition",
      weight: 10,
      score: input.brandRecognized ? 0.9 : 0.4,
      note: input.brandRecognized ? "Recognized brand" : "Weak or unknown brand",
    },
    {
      key: "seasonality",
      label: "Seasonality",
      weight: 5,
      score: input.seasonal ? 0.4 : 0.8,
      note: input.seasonal ? "Seasonal demand risk" : "Year-round demand assumed",
    },
    {
      key: "price_spread",
      label: "Price spread",
      weight: 5,
      score: clamp(1 - spread, 0, 1),
      note: `Interquartile spread ≈ ${(spread * 100).toFixed(0)}% of median`,
    },
    {
      key: "shipping",
      label: "Shipping difficulty",
      weight: 5,
      score:
        input.shipping.band === "small_lightweight" || input.shipping.band === "small_dense"
          ? 0.9
          : input.shipping.band === "medium"
            ? 0.7
            : input.shipping.band === "large"
              ? 0.5
              : 0.2,
      note: `Shipping band: ${input.shipping.band}`,
    },
    {
      key: "condition",
      label: "Condition",
      weight: 10,
      score: CONDITION_SCORE[input.condition],
      note: `Condition: ${input.condition}`,
    },
    {
      key: "testing",
      label: "Testing difficulty",
      weight: 5,
      score: input.hardToTest ? 0.3 : 0.8,
      note: input.hardToTest ? "Hard to fully test before listing" : "Easy to test",
    },
    {
      key: "compatibility",
      label: "Compatibility risk",
      weight: 3,
      score: input.compatibilityRisk ? 0.3 : 0.9,
      note: input.compatibilityRisk ? "Buyers may order the wrong variant" : "Low compatibility confusion",
    },
    {
      key: "returns",
      label: "Return risk",
      weight: 4,
      score: 1 - clamp((1 - CONDITION_SCORE[input.condition]) * 1.2, 0, 1),
      note: "Derived from condition",
    },
    {
      key: "cash",
      label: "Cash tied up",
      weight: 3,
      score: clamp(1 - input.cashTiedUpCents / 50_000, 0, 1),
      note: `≈$${(input.cashTiedUpCents / 100).toFixed(0)} invested until sale`,
    },
  ];

  const score = Math.round(factors.reduce((acc, f) => acc + f.weight * f.score, 0));
  const lowConfidence = stats.evidenceGrade === "active_only" || stats.evidenceGrade === "insufficient" || sold < 3;

  return { score, label: velocityLabel(score), lowConfidence, factors };
}
