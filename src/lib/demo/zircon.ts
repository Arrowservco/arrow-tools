import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { MarketResearch, ProductIdentity, ShippingResearch } from "@/lib/ai/schemas/research";

/**
 * Demo Mode fixture: the Zircon SuperScan ID One Touch stud finder Mac.bid
 * screenshot. All market "evidence" below is MOCK DATA for demonstrating the
 * workflow — it is clearly labeled in the UI as "Demo data, not live market
 * evidence" and must never be presented as real research.
 */

const cv = <T>(value: T | null, confidence: number, sourceText: string | null = null) => ({
  value,
  confidence,
  sourceText,
});

export function zirconDemoExtraction(): MacBidScreenshotExtraction {
  return {
    product: {
      title: cv("Zircon SuperScan ID One Touch Stud Finder", 0.95, "Zircon SuperScan ID One Touch Stud Finder"),
      brand: cv("Zircon", 0.95),
      modelNumber: cv("SuperScan ID", 0.7),
      upc: cv<string>(null, 0),
      mpn: cv<string>(null, 0),
      categoryGuess: cv("Tools & Home Improvement", 0.8),
      condition: cv<"open_box">("open_box", 0.9, "OPEN BOX"),
      includedItems: [],
      possiblyMissingItems: ["Original packaging condition unknown"],
    },
    auction: {
      currentBid: cv(1, 0.95, "Bid $1"),
      bidCount: cv<number>(null, 0),
      timeRemainingText: cv("2d 21h 16m 26s", 0.9),
      auctionEndTime: cv<string>(null, 0),
    },
    instantWin: {
      available: cv(true, 0.95),
      price: cv(56, 0.95, "$56 Instant Win"),
      timeRemainingText: cv("2d 2h 6m 39s", 0.9, "Offer Expires: 2d 2h 6m 39s"),
      expirationTime: cv<string>(null, 0),
    },
    macBid: {
      displayedRetailPrice: cv(70, 0.9, "$70 est. retail"),
      displayedAllInTotal: cv<number>(null, 0),
      buyerPremiumRate: cv<number>(null, 0),
      lotFee: cv<number>(null, 0),
      taxAmount: cv<number>(null, 0),
      salesTaxRate: cv<number>(null, 0),
      pickupLocation: cv<string>(null, 0),
      transferEligible: cv<boolean>(null, 0),
      transferFee: cv<number>(null, 0),
    },
    protection: {
      available: cv(true, 0.95, "shield icon $7"),
      price: cv(7, 0.95, "$7"),
      enabledInScreenshot: cv(false, 0.9, "toggle appears off"),
    },
    warnings: ["Model number partially inferred from title — verify SuperScan ID variant (K vs. standard)."],
    uncertainFields: ["product.modelNumber", "macBid.pickupLocation"],
    overallConfidence: 0.88,
  };
}

export function zirconDemoIdentity(): ProductIdentity {
  return {
    matchLevel: "probable_match",
    identityConfidence: 0.86,
    resolvedBy: "brand_model_phrase",
    candidates: [
      {
        productName: "Zircon SuperScan ID One Touch Stud Finder",
        brand: "Zircon",
        model: "SuperScan ID",
        matchConfidence: 0.86,
        whyItMayMatch: "Brand and model phrase match the listing title exactly.",
        importantDifferences: "Zircon also sells a SuperScan K variant with different sensor depth.",
      },
    ],
    notes: "DEMO DATA — identity resolution mocked for demonstration.",
  };
}

export function zirconDemoMarket(): MarketResearch {
  return {
    comparables: [
      {
        sourceTitle: "Zircon SuperScan ID One Touch Stud Finder - New Open Box",
        sourceUrl: "https://www.ebay.com/itm/demo-1",
        price: 44.99, shippingPrice: 0, condition: "Open box", dateText: "Sold Jun 2026",
        soldStatus: "sold", exactModelMatch: true, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.95, exclusionReason: null,
      },
      {
        sourceTitle: "Zircon SuperScan ID Stud Finder Wall Scanner",
        sourceUrl: "https://www.ebay.com/itm/demo-2",
        price: 47.5, shippingPrice: 6.99, condition: "Used", dateText: "Sold Jun 2026",
        soldStatus: "sold", exactModelMatch: true, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.9, exclusionReason: null,
      },
      {
        sourceTitle: "Zircon SuperScan ID One Touch - Open Box, Tested",
        sourceUrl: "https://www.ebay.com/itm/demo-3",
        price: 52.0, shippingPrice: 0, condition: "Open box", dateText: "Sold May 2026",
        soldStatus: "sold", exactModelMatch: true, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.93, exclusionReason: null,
      },
      {
        sourceTitle: "Zircon SuperScan ID stud finder NEW SEALED",
        sourceUrl: "https://www.ebay.com/itm/demo-4",
        price: 55.99, shippingPrice: 5.5, condition: "New", dateText: "Sold May 2026",
        soldStatus: "sold", exactModelMatch: true, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.85, exclusionReason: null,
      },
      {
        sourceTitle: "Zircon SuperScan ID One Touch Stud Finder",
        sourceUrl: "https://www.ebay.com/itm/demo-5",
        price: 54.99, shippingPrice: 0, condition: "Open box", dateText: null,
        soldStatus: "active", exactModelMatch: true, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.9, exclusionReason: null,
      },
      {
        sourceTitle: "Zircon stud finder FOR PARTS not working",
        sourceUrl: "https://www.ebay.com/itm/demo-6",
        price: 12.0, shippingPrice: 5.0, condition: "For parts", dateText: "Sold Jun 2026",
        soldStatus: "sold", exactModelMatch: true, accessoryMatch: false, quantityMatch: true,
        relevanceScore: 0.2, exclusionReason: "Parts only / not working",
      },
      {
        sourceTitle: "Zircon MetalliScanner m40 (different model)",
        sourceUrl: "https://www.ebay.com/itm/demo-7",
        price: 25.0, shippingPrice: 4.0, condition: "Used", dateText: "Sold Jun 2026",
        soldStatus: "sold", exactModelMatch: false, accessoryMatch: true, quantityMatch: true,
        relevanceScore: 0.3, exclusionReason: "Different model",
      },
    ],
    verifiedRetailPrice: 69.99,
    activeCompetitionEstimate: 14,
    brandRecognized: true,
    seasonal: false,
    categoryGuess: "Tools & Home Improvement",
    sources: [
      { title: "eBay sold listings (demo)", url: "https://www.ebay.com/sch/demo", kind: "sold_listing", note: "Demo data, not live market evidence" },
      { title: "Zircon.com product page (demo)", url: "https://www.zircon.com/demo", kind: "manufacturer", note: "Demo data, not live market evidence" },
    ],
    notes: ["DEMO DATA — mock research evidence, not live market research."],
  };
}

export function zirconDemoShipping(): ShippingResearch {
  return {
    itemWeightOz: 10,
    packedWeightOz: 15,
    packageDimensionsIn: { l: 10, w: 7, h: 4 },
    source: "product_spec",
    confidence: 0.75,
    notes: "DEMO DATA — Zircon lists ~9.6 oz item weight; small padded box assumed.",
  };
}
