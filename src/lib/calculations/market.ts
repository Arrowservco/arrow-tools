import { applyRate, roundCents, type Cents } from "@/lib/money";
import type { EvidenceGrade, MarketComparable, MarketStats } from "@/types/domain";

/** Phrases that force rejection of a comparable regardless of AI relevance. */
export const HARD_EXCLUSION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /parts\s*only|for\s*parts/i, reason: "Parts only" },
  { pattern: /empty\s*box|box\s*only/i, reason: "Empty box" },
  { pattern: /manual\s*only|instructions\s*only/i, reason: "Manual only" },
  { pattern: /\bbattery\s*only\b/i, reason: "Battery only" },
  { pattern: /\bcharger\s*only\b/i, reason: "Charger only" },
  { pattern: /replacement\s*(accessory|part|blade|pad|filter)/i, reason: "Replacement accessory" },
  { pattern: /\bbroken\b|not\s*working|doesn'?t\s*(work|power)/i, reason: "Broken / not working" },
  { pattern: /for\s*repair|as[-\s]*is\b/i, reason: "For repair / as-is" },
  { pattern: /local\s*pick\s*-?up\s*only/i, reason: "Local pickup only" },
];

export function applyHardExclusions(comp: MarketComparable): MarketComparable {
  for (const { pattern, reason } of HARD_EXCLUSION_PATTERNS) {
    if (pattern.test(comp.sourceTitle)) {
      return { ...comp, accepted: false, exclusionReason: comp.exclusionReason ?? reason };
    }
  }
  if (comp.priceCents === null) {
    return { ...comp, accepted: false, exclusionReason: comp.exclusionReason ?? "No visible price" };
  }
  if (!comp.exactModelMatch && comp.relevanceScore < 0.6) {
    return { ...comp, accepted: false, exclusionReason: comp.exclusionReason ?? "Different or unverified model" };
  }
  if (!comp.quantityMatch) {
    return { ...comp, accepted: false, exclusionReason: comp.exclusionReason ?? "Different quantity / lot size" };
  }
  return comp;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export interface MarketStatsInput {
  comparables: MarketComparable[];
  verifiedRetailCents: Cents | null;
  /** Conservative category estimate when nothing else exists. */
  categoryEstimateCents?: Cents | null;
  activeCompetitionCount?: number | null;
}

/**
 * Compute market statistics from classified comparables. Sold comps drive the
 * primary estimate; when sold evidence is weak the estimate falls back to the
 * lower of 75% of median active ask, 65% of verified retail, or a category
 * estimate — and the result is labeled provisional.
 */
export function computeMarketStats(input: MarketStatsInput): MarketStats {
  const processed = input.comparables.map(applyHardExclusions);
  const accepted = processed.filter((c) => c.accepted && c.priceCents !== null);
  const sold = accepted.filter((c) => c.soldStatus === "sold");
  const active = accepted.filter((c) => c.soldStatus === "active");
  const notes: string[] = [];

  const soldPrices = sold.map((c) => c.priceCents as number).sort((a, b) => a - b);
  const activePrices = active.map((c) => c.priceCents as number).sort((a, b) => a - b);

  let evidenceGrade: EvidenceGrade;
  if (sold.length >= 3) evidenceGrade = "strong_sold";
  else if (sold.length >= 1) evidenceGrade = "partial_sold";
  else if (active.length >= 2) evidenceGrade = "active_only";
  else evidenceGrade = "insufficient";

  const basis = soldPrices.length >= 1 ? soldPrices : activePrices;
  const median = basis.length ? roundCents(percentile(basis, 0.5)) : null;
  const mean = basis.length ? roundCents(basis.reduce((a, b) => a + b, 0) / basis.length) : null;
  const p25 = basis.length ? roundCents(percentile(basis, 0.25)) : null;
  const p75 = basis.length ? roundCents(percentile(basis, 0.75)) : null;
  // Outlier-adjusted bounds: clip to [p25 - 1.5*IQR, p75 + 1.5*IQR] observed range.
  let lowerAdj: Cents | null = null;
  let upperAdj: Cents | null = null;
  if (basis.length && p25 !== null && p75 !== null) {
    const iqr = p75 - p25;
    lowerAdj = roundCents(Math.max(basis[0], p25 - 1.5 * iqr));
    upperAdj = roundCents(Math.min(basis[basis.length - 1], p75 + 1.5 * iqr));
  }

  let quick: Cents | null = null;
  let expected: Cents | null = null;
  let patient: Cents | null = null;
  let provisional = false;

  if (soldPrices.length >= 1) {
    // Sold-evidence pricing: quick = p25-ish, expected = median, patient = p75.
    quick = p25;
    expected = median;
    patient = p75;
    if (soldPrices.length < 3) {
      notes.push("Fewer than 3 sold comps — treat pricing as partially provisional.");
      provisional = true;
      // Blend down with the active/retail fallback when it is lower.
      const fb = fallbackEstimate(activePrices, input.verifiedRetailCents, input.categoryEstimateCents ?? null);
      if (fb !== null && expected !== null && fb < expected) {
        expected = roundCents((expected + fb) / 2);
        quick = quick !== null ? Math.min(quick, applyRate(expected, 0.85)) : applyRate(expected, 0.85);
        notes.push("Expected price blended with conservative fallback due to thin sold evidence.");
      }
    }
  } else {
    const fb = fallbackEstimate(activePrices, input.verifiedRetailCents, input.categoryEstimateCents ?? null);
    if (fb !== null) {
      expected = fb;
      quick = applyRate(fb, 0.85);
      patient = applyRate(fb, 1.1);
      provisional = true;
      notes.push(
        "No sold evidence: resale estimate is the LOWER of 75% of median active ask, 65% of verified retail, or a conservative category estimate. Provisional.",
      );
    }
  }

  const marketConfidence =
    evidenceGrade === "strong_sold"
      ? Math.min(0.9, 0.6 + sold.length * 0.05)
      : evidenceGrade === "partial_sold"
        ? 0.55
        : evidenceGrade === "active_only"
          ? 0.35
          : 0.1;

  return {
    acceptedCompCount: accepted.length,
    soldCompCount: sold.length,
    medianCents: median,
    meanCents: mean,
    p25Cents: p25,
    p75Cents: p75,
    lowerAdjustedCents: lowerAdj,
    upperAdjustedCents: upperAdj,
    quickSaleCents: quick,
    expectedCents: expected,
    patientCents: patient,
    activeCompetitionCount: input.activeCompetitionCount ?? (active.length || null),
    evidenceGrade,
    marketConfidence,
    provisional,
    notes,
  };
}

function fallbackEstimate(
  activePricesSorted: number[],
  verifiedRetailCents: Cents | null,
  categoryEstimateCents: Cents | null,
): Cents | null {
  const candidates: Cents[] = [];
  if (activePricesSorted.length) {
    candidates.push(applyRate(roundCents(percentile(activePricesSorted, 0.5)), 0.75));
  }
  if (verifiedRetailCents !== null) candidates.push(applyRate(verifiedRetailCents, 0.65));
  if (categoryEstimateCents !== null) candidates.push(categoryEstimateCents);
  if (!candidates.length) return null;
  return Math.min(...candidates);
}
