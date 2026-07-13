import { describe, expect, it } from "vitest";
import { calculateAcquisition } from "@/lib/calculations/macbid";
import { ericStandardProfile } from "@/lib/profile";

const fees = ericStandardProfile().macBid;

describe("Mac.bid acquisition cost", () => {
  it("computes the $1 bid / 15% premium / $3 lot fee / 6% tax case (protection off)", () => {
    const acq = calculateAcquisition({ hammerBidCents: 100, protectionCents: 0, fees });
    expect(acq.buyerPremiumCents).toBe(15);
    expect(acq.lotFeeCents).toBe(300);
    // tax base = 100 + 15 + 300 = 415 → 6% = 24.9 → 25
    expect(acq.salesTaxCents).toBe(25);
    expect(acq.totalCents).toBe(100 + 15 + 300 + 25);
  });

  it("includes $7 protection in cost and tax base when enabled", () => {
    const acq = calculateAcquisition({ hammerBidCents: 100, protectionCents: 700, fees });
    // tax base = 100 + 15 + 300 + 700 = 1115 → 66.9 → 67
    expect(acq.salesTaxCents).toBe(67);
    expect(acq.protectionCents).toBe(700);
    expect(acq.totalCents).toBe(100 + 15 + 300 + 700 + 67);
  });

  it("adds a transfer fee and taxes it per the configured base", () => {
    const acq = calculateAcquisition({
      hammerBidCents: 1000,
      protectionCents: 0,
      fees: { ...fees, transferFeeCents: 500 },
    });
    // base = 1000 + 150 + 300 + 500 = 1950 → 117
    expect(acq.salesTaxCents).toBe(117);
    expect(acq.totalCents).toBe(1000 + 150 + 300 + 500 + 117);
  });

  it("respects a configurable taxable base (hammer only)", () => {
    const acq = calculateAcquisition({
      hammerBidCents: 1000,
      protectionCents: 700,
      fees: {
        ...fees,
        taxableBase: { hammerBid: true, buyerPremium: false, lotFee: false, protection: false, transferFee: false },
      },
    });
    expect(acq.salesTaxCents).toBe(60);
  });

  it("uses the displayed total when selected and flags discrepancies over $0.50", () => {
    const acq = calculateAcquisition({
      hammerBidCents: 100,
      protectionCents: 0,
      fees,
      displayedTotalCents: 550,
      useDisplayedTotal: true,
    });
    expect(acq.usedDisplayedTotal).toBe(true);
    expect(acq.totalCents).toBe(550);
    expect(acq.discrepancyCents).toBe(550 - 440);
    expect(acq.discrepancyWarning).toBe(true);
  });

  it("does not warn when the displayed total is within $0.50", () => {
    const acq = calculateAcquisition({
      hammerBidCents: 100,
      protectionCents: 0,
      fees,
      displayedTotalCents: 470,
      useDisplayedTotal: false,
    });
    expect(acq.discrepancyWarning).toBe(false);
    expect(acq.totalCents).toBe(440); // calculated total controls
  });
});
