import { describe, expect, it } from "vitest";
import { calculateAcquisition } from "@/lib/calculations/macbid";
import { calculateEbayFees } from "@/lib/calculations/ebayFees";
import { computeScenario, computeScenarioSet } from "@/lib/calculations/profitability";
import { estimateShipping } from "@/lib/calculations/shipping";
import { ericStandardProfile } from "@/lib/profile";

const profile = ericStandardProfile();

function acquisition(hammerCents: number, protectionCents = 0) {
  return calculateAcquisition({ hammerBidCents: hammerCents, protectionCents, fees: profile.macBid });
}

describe("eBay fees", () => {
  it("applies the FVF and promotion to item price + buyer-paid shipping", () => {
    const fees = calculateEbayFees({
      itemPriceCents: 3500,
      buyerShippingCents: 699,
      profile: profile.ebay,
    });
    expect(fees.feeBaseCents).toBe(4199);
    expect(fees.finalValueFeeCents).toBe(Math.round(4199 * 0.1335));
    expect(fees.promotedListingFeeCents).toBe(Math.round(4199 * 0.05));
    expect(fees.perOrderFeeCents).toBe(40);
  });

  it("0% promotion removes the promoted listing fee", () => {
    const fees = calculateEbayFees({
      itemPriceCents: 3500,
      buyerShippingCents: 699,
      profile: profile.ebay,
      promotionRateOverride: 0,
    });
    expect(fees.promotedListingFeeCents).toBe(0);
  });
});

describe("profitability scenarios", () => {
  const shipping = estimateShipping({ band: "small_lightweight" });

  it("buyer-paid shipping adds revenue but also fees and label cost", () => {
    const acq = acquisition(100); // $4.40 all-in
    const s = computeScenario({
      name: "expected",
      salePriceCents: 3500,
      buyerShippingCents: shipping.buyerChargeCents,
      shippingLabelCents: shipping.expectedLabelCents,
      packagingCents: shipping.packagingCents,
      returnReserveRate: 0.05,
      accessoryAllowanceCents: 0,
      acquisition: acq,
      ebay: profile.ebay,
    });
    expect(s.transactionRevenueCents).toBe(3500 + 699);
    // Label cost and packaging are real expenses.
    expect(s.expenses.shippingLabelCents).toBe(550);
    expect(s.expenses.packagingCents).toBe(100);
    // Fees applied to the full base (item + shipping).
    expect(s.expenses.finalValueFeeCents).toBe(Math.round(4199 * 0.1335));
    expect(s.netProfitCents).toBe(
      s.transactionRevenueCents - s.expenses.totalCents - acq.totalCents,
    );
    expect(s.netProfitCents).toBeGreaterThan(2000);
  });

  it("promotion rate changes net profit deterministically (5% vs 0%)", () => {
    const acq = acquisition(100);
    const base = {
      quickSaleCents: 3200,
      expectedCents: 3500,
      patientCents: 3900,
      shipping,
      condition: "open_box" as const,
      accessoryUncertain: false,
      acquisition: acq,
      ebay: profile.ebay,
    };
    const withPromo = computeScenarioSet({ ...base, promotionRateOverride: 0.05 });
    const noPromo = computeScenarioSet({ ...base, promotionRateOverride: 0 });
    const promoFee = Math.round((3500 + shipping.buyerChargeCents) * 0.05);
    expect(noPromo.expected.netProfitCents - withPromo.expected.netProfitCents).toBe(promoFee);
  });

  it("computes acquisition ROI and total-cash ROI", () => {
    const acq = acquisition(2000); // $20 hammer
    const s = computeScenario({
      name: "expected",
      salePriceCents: 6000,
      buyerShippingCents: 699,
      shippingLabelCents: 550,
      packagingCents: 100,
      returnReserveRate: 0.05,
      accessoryAllowanceCents: 0,
      acquisition: acq,
      ebay: profile.ebay,
    });
    expect(s.acquisitionRoi).toBeCloseTo(s.netProfitCents / acq.totalCents, 10);
    expect(s.totalCashRoi).toBeCloseTo(s.netProfitCents / (acq.totalCents + 550 + 100), 10);
    expect(s.totalCashRoi!).toBeLessThan(s.acquisitionRoi!);
  });

  it("handles negative profit", () => {
    const acq = acquisition(5000);
    const s = computeScenario({
      name: "conservative",
      salePriceCents: 3000,
      buyerShippingCents: 699,
      shippingLabelCents: 750,
      packagingCents: 100,
      returnReserveRate: 0.075,
      accessoryAllowanceCents: 500,
      acquisition: acq,
      ebay: profile.ebay,
    });
    expect(s.netProfitCents).toBeLessThan(0);
    expect(s.acquisitionRoi!).toBeLessThan(0);
  });

  it("guards zero acquisition cost (ROI null, no crash)", () => {
    const acq = calculateAcquisition({
      hammerBidCents: 0,
      protectionCents: 0,
      fees: { ...profile.macBid, lotFeeCents: 0 },
    });
    expect(acq.totalCents).toBe(0);
    const s = computeScenario({
      name: "expected",
      salePriceCents: 3000,
      buyerShippingCents: 0,
      shippingLabelCents: 0,
      packagingCents: 0,
      returnReserveRate: 0,
      accessoryAllowanceCents: 0,
      acquisition: acq,
      ebay: profile.ebay,
    });
    expect(s.acquisitionRoi).toBeNull();
    expect(s.totalCashRoi).toBeNull();
  });

  it("conservative scenario uses higher reserve and accessory allowance", () => {
    const acq = acquisition(100);
    const set = computeScenarioSet({
      quickSaleCents: 3200,
      expectedCents: 3500,
      patientCents: 3900,
      shipping,
      condition: "open_box",
      accessoryUncertain: true,
      acquisition: acq,
      ebay: profile.ebay,
    });
    expect(set.conservative.expenses.accessoryAllowanceCents).toBeGreaterThan(0);
    expect(set.expected.expenses.accessoryAllowanceCents).toBe(0);
    expect(set.conservative.expenses.returnRiskReserveCents).toBeGreaterThan(
      Math.round((set.expected.expenses.returnRiskReserveCents * 3200) / 3500),
    );
    expect(set.conservative.expenses.shippingLabelCents).toBe(shipping.conservativeLabelCents);
  });
});
