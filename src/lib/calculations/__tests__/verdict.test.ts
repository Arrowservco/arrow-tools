import { describe, expect, it } from "vitest";
import { decideVerdict, type VerdictInput } from "@/lib/calculations/verdict";
import type { ScenarioResult, VelocityResult } from "@/types/domain";
import { ericStandardProfile } from "@/lib/profile";

const thresholds = ericStandardProfile().thresholds;

function scenario(netCents: number, roi: number | null): ScenarioResult {
  return {
    name: "conservative",
    salePriceCents: 3500,
    buyerShippingCents: 699,
    transactionRevenueCents: 4199,
    expenses: {
      finalValueFeeCents: 0, perOrderFeeCents: 0, promotedListingFeeCents: 0, feeBufferCents: 0,
      shippingLabelCents: 0, packagingCents: 0, returnRiskReserveCents: 0, accessoryAllowanceCents: 0,
      totalCents: 0,
    },
    acquisitionTotalCents: roi === null ? 0 : Math.round(netCents / roi),
    netProfitCents: netCents,
    acquisitionRoi: roi,
    totalCashRoi: roi,
  };
}

function velocity(score: number): VelocityResult {
  return { score, label: score >= 75 ? "fast" : score >= 60 ? "moderate" : "slow", lowConfidence: false, factors: [] };
}

function baseInput(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    channel: "auction",
    identityConfidence: 0.9,
    evidenceGrade: "strong_sold",
    conservative: scenario(3000, 1.2),
    expected: scenario(3800, 1.6),
    thresholds,
    velocity: velocity(80),
    overallRisk: "moderate",
    currentPriceCents: 100,
    maxPriceCents: 1400,
    criticalValuesMissing: false,
    researchFailed: false,
    ...overrides,
  };
}

describe("verdict engine", () => {
  it("returns strong_buy when everything is excellent", () => {
    const v = decideVerdict(baseInput());
    expect(v.verdict).toBe("strong_buy");
  });

  it("returns buy_below when evidence is adequate but not exceptional", () => {
    const v = decideVerdict(baseInput({ evidenceGrade: "partial_sold", identityConfidence: 0.8 }));
    expect(v.verdict).toBe("buy_below");
    expect(v.buyBelowCents).toBe(1400);
  });

  it("returns borderline when the current bid is near the ceiling", () => {
    const v = decideVerdict(baseInput({ currentPriceCents: 1350 }));
    expect(v.verdict).toBe("borderline");
  });

  it("returns borderline when the math barely passes", () => {
    const v = decideVerdict(baseInput({ conservative: scenario(2100, 0.55) }));
    expect(v.verdict).toBe("borderline");
  });

  it("returns pass when the profit floor fails", () => {
    const v = decideVerdict(baseInput({ conservative: scenario(1500, 1.2) }));
    expect(v.verdict).toBe("pass");
  });

  it("returns pass when the conservative ROI floor fails", () => {
    const v = decideVerdict(baseInput({ conservative: scenario(2500, 0.4) }));
    expect(v.verdict).toBe("pass");
  });

  it("returns pass when the expected ROI floor fails", () => {
    const v = decideVerdict(baseInput({ expected: scenario(3000, 0.6) }));
    expect(v.verdict).toBe("pass");
  });

  it("returns pass when the current price exceeds the maximum", () => {
    const v = decideVerdict(baseInput({ currentPriceCents: 2000, maxPriceCents: 1400 }));
    expect(v.verdict).toBe("pass");
  });

  it("returns insufficient_evidence when research failed", () => {
    const v = decideVerdict(baseInput({ researchFailed: true }));
    expect(v.verdict).toBe("insufficient_evidence");
  });

  it("returns insufficient_evidence when evidence grade is insufficient", () => {
    const v = decideVerdict(baseInput({ evidenceGrade: "insufficient" }));
    expect(v.verdict).toBe("insufficient_evidence");
  });

  it("returns confirm_product below 70% identity confidence", () => {
    const v = decideVerdict(baseInput({ identityConfidence: 0.6 }));
    expect(v.verdict).toBe("confirm_product");
  });

  it("never returns strong_buy on low confidence, weak evidence, or high risk", () => {
    expect(decideVerdict(baseInput({ identityConfidence: 0.75 })).verdict).not.toBe("strong_buy");
    expect(decideVerdict(baseInput({ evidenceGrade: "active_only" })).verdict).not.toBe("strong_buy");
    expect(decideVerdict(baseInput({ overallRisk: "high" })).verdict).not.toBe("strong_buy");
    expect(decideVerdict(baseInput({ velocity: velocity(50) })).verdict).not.toBe("strong_buy");
  });
});
