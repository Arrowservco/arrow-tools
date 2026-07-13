import type {
  ItemCondition,
  ListingFacts,
  MarketStats,
  RiskAssessment,
  RiskFlag,
  RiskLevel,
  ShippingEstimate,
} from "@/types/domain";

const LEVEL_RANK: Record<RiskLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  very_high: 3,
};

export interface RiskInput {
  listing: ListingFacts;
  stats: MarketStats;
  shipping: ShippingEstimate;
  categoryGuess: string | null;
}

const ELECTRONICS_HINTS = /electronic|tool|drill|wrench|scanner|finder|camera|audio|speaker|monitor|laptop|tablet|phone|console|battery|charger|vacuum|appliance/i;
const COUNTERFEIT_HINTS = /airpods|apple|beats|dyson|rolex|louis|gucci|yeezy|jordan|pokemon/i;

/**
 * Deterministic rule-based risk flags. The AI may add narrative, but these
 * rules set the floor.
 */
export function assessRisk(input: RiskInput): RiskAssessment {
  const flags: RiskFlag[] = [];
  const { listing, stats, shipping } = input;

  // Product identity
  if (listing.identityConfidence < 0.5 || listing.identityMatch === "no_reliable_match") {
    flags.push({
      key: "identity",
      label: "Product identity",
      level: "very_high",
      detail: "No reliable product match — resale estimates may target the wrong item.",
    });
  } else if (listing.identityConfidence < 0.7 || listing.identityMatch === "ambiguous") {
    flags.push({
      key: "identity",
      label: "Product identity",
      level: "high",
      detail: "Exact model not confirmed — confirm the product before bidding seriously.",
    });
  } else if (listing.identityMatch === "possible_match" || !listing.model) {
    flags.push({
      key: "identity",
      label: "Product identity",
      level: "moderate",
      detail: "Model number not fully verified.",
    });
  } else {
    flags.push({ key: "identity", label: "Product identity", level: "low", detail: "Exact or probable model match." });
  }

  // Condition
  const conditionLevel: Record<ItemCondition, RiskLevel> = {
    new: "low",
    like_new: "moderate",
    open_box: "moderate",
    used: "high",
    damaged: "very_high",
    parts_only: "very_high",
    unknown: "high",
  };
  const isElectronics = ELECTRONICS_HINTS.test(`${listing.title} ${input.categoryGuess ?? ""}`);
  let condLevel = conditionLevel[listing.condition];
  if (isElectronics && (listing.condition === "open_box" || listing.condition === "like_new")) {
    condLevel = "moderate";
  }
  flags.push({
    key: "condition",
    label: "Condition",
    level: condLevel,
    detail:
      listing.condition === "open_box" && isElectronics
        ? "Open-box electronics: functionality not verified by Mac.bid."
        : `Condition: ${listing.condition.replace(/_/g, " ")}.`,
  });

  // Completeness
  if (listing.possiblyMissingItems.length > 0) {
    flags.push({
      key: "completeness",
      label: "Completeness",
      level: listing.possiblyMissingItems.length > 1 ? "high" : "moderate",
      detail: `Possibly missing: ${listing.possiblyMissingItems.join(", ")}.`,
    });
  } else {
    flags.push({
      key: "completeness",
      label: "Completeness",
      level: listing.condition === "open_box" ? "moderate" : "low",
      detail:
        listing.condition === "open_box"
          ? "Open-box: accessory completeness cannot be assumed."
          : "No missing accessories flagged.",
    });
  }

  // Shipping
  const shippingLevel: RiskLevel =
    shipping.band === "oversized" || shipping.band === "freight_like"
      ? "high"
      : shipping.band === "large" || shipping.dimensionalWeightRisk
        ? "moderate"
        : "low";
  flags.push({
    key: "shipping",
    label: "Shipping",
    level: shipping.confidence < 0.4 && shippingLevel === "low" ? "moderate" : shippingLevel,
    detail: `Band ${shipping.band.replace(/_/g, " ")}${shipping.dimensionalWeightRisk ? ", dimensional-weight risk" : ""}; confidence ${(shipping.confidence * 100).toFixed(0)}%.`,
  });

  // Return risk
  flags.push({
    key: "returns",
    label: "Returns",
    level: condLevel === "very_high" ? "very_high" : isElectronics ? "moderate" : "low",
    detail: isElectronics
      ? "Electronics carry above-average return rates on eBay."
      : "Standard return exposure.",
  });

  // Market evidence
  const evidenceLevel: RiskLevel =
    stats.evidenceGrade === "strong_sold"
      ? "low"
      : stats.evidenceGrade === "partial_sold"
        ? "moderate"
        : stats.evidenceGrade === "active_only"
          ? "high"
          : "very_high";
  flags.push({
    key: "market",
    label: "Market evidence",
    level: stats.acceptedCompCount < 3 && evidenceLevel === "low" ? "moderate" : evidenceLevel,
    detail: `${stats.soldCompCount} sold / ${stats.acceptedCompCount} accepted comps (grade: ${stats.evidenceGrade.replace(/_/g, " ")}).`,
  });

  // Price volatility
  const spread =
    stats.p25Cents !== null && stats.p75Cents !== null && stats.medianCents && stats.medianCents > 0
      ? (stats.p75Cents - stats.p25Cents) / stats.medianCents
      : null;
  flags.push({
    key: "volatility",
    label: "Price volatility",
    level: spread === null ? "moderate" : spread > 0.5 ? "high" : spread > 0.25 ? "moderate" : "low",
    detail:
      spread === null
        ? "Not enough comps to measure spread."
        : `Interquartile spread ≈ ${(spread * 100).toFixed(0)}% of median.`,
  });

  // Counterfeit
  if (COUNTERFEIT_HINTS.test(listing.title)) {
    flags.push({
      key: "counterfeit",
      label: "Counterfeit exposure",
      level: "moderate",
      detail: "High-counterfeit brand category — verify authenticity before listing.",
    });
  }

  const worst = flags.reduce<RiskLevel>((acc, f) => (LEVEL_RANK[f.level] > LEVEL_RANK[acc] ? f.level : acc), "low");
  const highCount = flags.filter((f) => LEVEL_RANK[f.level] >= 2).length;
  // Overall: worst flag, softened one step if it is the only elevated flag
  // and everything else is low.
  let overall: RiskLevel = worst;
  if (worst === "high" && highCount === 1 && flags.filter((f) => f.level === "moderate").length <= 1) {
    overall = "moderate";
  }
  return { flags, overall };
}
