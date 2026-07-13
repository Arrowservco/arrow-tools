import { describe, expect, it } from "vitest";
import { calculateMaxBids, solveMaxHammer, type MaxBidSolverInput } from "@/lib/calculations/maximumBid";
import { calculateAcquisition } from "@/lib/calculations/macbid";
import { computeScenarioSet } from "@/lib/calculations/profitability";
import { estimateShipping } from "@/lib/calculations/shipping";
import { ericStandardProfile } from "@/lib/profile";

const profile = ericStandardProfile();
const shipping = estimateShipping({ band: "small_lightweight" });

function solverInput(overrides: Partial<MaxBidSolverInput> = {}): MaxBidSolverInput {
  return {
    macBidFees: profile.macBid,
    protectionCents: 700,
    protectionEnabled: false,
    thresholds: profile.thresholds,
    scenarioBase: {
      quickSaleCents: 6000,
      expectedCents: 7000,
      patientCents: 8000,
      shipping,
      condition: "open_box",
      accessoryUncertain: false,
      ebay: profile.ebay,
    },
    currentBidCents: 100,
    instantWinCents: 5600,
    ...overrides,
  };
}

function scenariosAt(hammerCents: number, protectionCents = 0) {
  return computeScenarioSet({
    quickSaleCents: 6000,
    expectedCents: 7000,
    patientCents: 8000,
    shipping,
    condition: "open_box",
    accessoryUncertain: false,
    ebay: profile.ebay,
    acquisition: calculateAcquisition({ hammerBidCents: hammerCents, protectionCents, fees: profile.macBid }),
  });
}

describe("binary-search solver", () => {
  it("returns null when even a $0 bid fails", () => {
    expect(solveMaxHammer(() => false)).toBeNull();
  });

  it("finds the exact cent boundary", () => {
    // Predicate true iff hammer <= 12345 cents.
    expect(solveMaxHammer((h) => h <= 12345)).toBe(12345);
  });
});

describe("maximum bid engine", () => {
  it("computes profit and ROI ceilings; recommended is the lowest, floored to whole dollars", () => {
    const result = calculateMaxBids(solverInput());
    expect(result.profitCeilingCents).not.toBeNull();
    expect(result.roiCeilingCents).not.toBeNull();
    expect(result.recommendedMaxBidCents).not.toBeNull();
    const rec = result.recommendedMaxBidCents!;
    expect(rec % 100).toBe(0); // whole-dollar rounding
    expect(rec).toBeLessThanOrEqual(Math.min(result.profitCeilingCents!, result.roiCeilingCents!));

    // At the recommended bid, every threshold must hold.
    const s = scenariosAt(rec);
    expect(s.conservative.netProfitCents).toBeGreaterThanOrEqual(2000);
    expect(s.conservative.acquisitionRoi!).toBeGreaterThanOrEqual(0.5);
    expect(s.expected.acquisitionRoi!).toBeGreaterThanOrEqual(0.75);

    // One dollar above the recommended bid, at least one threshold fails
    // (recommended = floor(combined ceiling), so +$1 exceeds the ceiling).
    const above = scenariosAt(rec + 100);
    const stillPasses =
      above.conservative.netProfitCents >= 2000 &&
      above.conservative.acquisitionRoi! >= 0.5 &&
      above.expected.acquisitionRoi! >= 0.75;
    expect(stillPasses).toBe(false);
  });

  it("protection lowers the maximum protected bid", () => {
    const result = calculateMaxBids(solverInput());
    expect(result.maxProtectedBidCents).not.toBeNull();
    expect(result.maxProtectedBidCents!).toBeLessThan(result.recommendedMaxBidCents!);
    const s = scenariosAt(result.maxProtectedBidCents!, 700);
    expect(s.conservative.netProfitCents).toBeGreaterThanOrEqual(2000);
  });

  it("reports bid room and detects current bid above ceiling", () => {
    const ok = calculateMaxBids(solverInput());
    expect(ok.bidRoomCents).toBe(ok.recommendedMaxBidCents! - 100);

    const high = calculateMaxBids(solverInput({ currentBidCents: 999900 }));
    expect(high.bidRoomCents).toBeLessThan(0);
  });

  it("evaluates Instant Win separately against the same thresholds", () => {
    const result = calculateMaxBids(solverInput());
    // $56 Instant Win on a ~$35 resale is far above the max IW price.
    expect(result.maxInstantWinCents).not.toBeNull();
    expect(result.maxInstantWinCents!).toBeLessThan(5600);
  });

  it("returns null ceilings when no bid can be profitable", () => {
    const result = calculateMaxBids(
      solverInput({
        scenarioBase: {
          quickSaleCents: 500,
          expectedCents: 600,
          patientCents: 700,
          shipping,
          condition: "open_box",
          accessoryUncertain: false,
          ebay: profile.ebay,
        },
      }),
    );
    expect(result.recommendedMaxBidCents).toBeNull();
    expect(result.bidRoomCents).toBeNull();
  });

  it("applies the absolute profile cap", () => {
    const result = calculateMaxBids(
      solverInput({
        thresholds: { ...profile.thresholds, absoluteMaxBidCents: 500 },
      }),
    );
    expect(result.recommendedMaxBidCents).toBe(500);
    expect(result.cappedByProfile).toBe(true);
  });
});
