import { floorToWholeDollar, type Cents } from "@/lib/money";
import { calculateAcquisition } from "@/lib/calculations/macbid";
import { computeScenarioSet, type ScenarioSetInput } from "@/lib/calculations/profitability";
import type { MacBidFeeProfile, MaxBidResult, ProfitabilityThresholds } from "@/types/domain";

export interface MaxBidSolverInput {
  macBidFees: MacBidFeeProfile;
  protectionCents: Cents; // price of optional protection when toggled on
  protectionEnabled: boolean;
  thresholds: ProfitabilityThresholds;
  /** Everything needed to price a scenario set except the acquisition. */
  scenarioBase: Omit<ScenarioSetInput, "acquisition">;
  currentBidCents: Cents;
  instantWinCents: Cents | null;
}

type Predicate = (hammerCents: Cents, protectionCents: Cents) => boolean;

function makeScenarios(
  input: MaxBidSolverInput,
  hammerCents: Cents,
  protectionCents: Cents,
) {
  const acquisition = calculateAcquisition({
    hammerBidCents: hammerCents,
    protectionCents,
    fees: input.macBidFees,
  });
  return computeScenarioSet({ ...input.scenarioBase, acquisition });
}

/**
 * Binary search for the largest hammer bid (integer cents) satisfying a
 * predicate. Fees and tax depend on the bid, so an algebraic inversion is
 * fragile; the search is exact to the cent and monotonicity holds because
 * every cost component is non-decreasing in the hammer bid.
 */
export function solveMaxHammer(predicate: (hammerCents: Cents) => boolean): Cents | null {
  if (!predicate(0)) return null;
  // Expand the upper bound until the predicate fails (cap at $1,000,000).
  let hi: Cents = 100_00;
  const CAP: Cents = 100_000_000;
  while (predicate(hi)) {
    if (hi >= CAP) return CAP;
    hi = Math.min(CAP, hi * 2);
  }
  let lo: Cents = 0; // predicate(lo) true, predicate(hi) false
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (predicate(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function roundBid(cents: Cents | null, thresholds: ProfitabilityThresholds): Cents | null {
  if (cents === null) return null;
  return thresholds.roundBidsToWholeDollars ? floorToWholeDollar(cents) : cents;
}

/**
 * Compute all bid ceilings. The controlling recommended bid is the lowest
 * applicable ceiling, rounded down so the rounded bid still satisfies every
 * threshold (profit decreases monotonically with bid, so rounding down is safe).
 */
export function calculateMaxBids(input: MaxBidSolverInput): MaxBidResult {
  const { thresholds } = input;
  const protectionWhenEnabled = input.protectionEnabled ? input.protectionCents : 0;

  const profitOk: Predicate = (h, p) =>
    makeScenarios(input, h, p).conservative.netProfitCents >= thresholds.minNetProfitCents;

  const roiOk: Predicate = (h, p) => {
    const s = makeScenarios(input, h, p);
    const cons = s.conservative.acquisitionRoi;
    const exp = s.expected.acquisitionRoi;
    // Zero-cost acquisitions (roi === null) pass the ROI floor by definition
    // as long as profit is non-negative.
    const consOk = cons === null ? s.conservative.netProfitCents >= 0 : cons >= thresholds.minConservativeRoi;
    const expOk = exp === null ? s.expected.netProfitCents >= 0 : exp >= thresholds.minExpectedRoi;
    return consOk && expOk;
  };

  const allOk: Predicate = (h, p) => profitOk(h, p) && roiOk(h, p);

  const profitCeiling = solveMaxHammer((h) => profitOk(h, protectionWhenEnabled));
  const roiCeiling = solveMaxHammer((h) => roiOk(h, protectionWhenEnabled));

  const combined = solveMaxHammer((h) => allOk(h, protectionWhenEnabled));
  let recommended = combined;
  let cappedByProfile = false;
  if (
    recommended !== null &&
    thresholds.absoluteMaxBidCents !== null &&
    recommended > thresholds.absoluteMaxBidCents
  ) {
    recommended = thresholds.absoluteMaxBidCents;
    cappedByProfile = true;
  }

  const maxProtected = solveMaxHammer((h) => allOk(h, input.protectionCents));
  let maxProtectedCapped = maxProtected;
  if (
    maxProtectedCapped !== null &&
    thresholds.absoluteMaxBidCents !== null &&
    maxProtectedCapped > thresholds.absoluteMaxBidCents
  ) {
    maxProtectedCapped = thresholds.absoluteMaxBidCents;
  }

  // Instant Win: the price is fixed; the "max Instant Win acquisition price"
  // is the highest fixed price that still clears every threshold (same fee
  // structure applied, since Mac.bid charges premium/lot/tax on Instant Win).
  const maxInstantWin = solveMaxHammer((h) => allOk(h, protectionWhenEnabled));

  const recommendedRounded = roundBid(recommended, thresholds);
  const bidRoomCents =
    recommendedRounded !== null ? recommendedRounded - input.currentBidCents : null;

  return {
    profitCeilingCents: roundBid(profitCeiling, thresholds),
    roiCeilingCents: roundBid(roiCeiling, thresholds),
    recommendedMaxBidCents: recommendedRounded,
    maxProtectedBidCents: roundBid(maxProtectedCapped, thresholds),
    maxInstantWinCents: roundBid(maxInstantWin, thresholds),
    bidRoomCents,
    cappedByProfile,
  };
}
