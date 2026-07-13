import type {
  AIProvider,
  ComparableClassificationInput,
  ComparableResearchResult,
  ConnectionResult,
  ListingExtractionResult,
  ProductResearchInput,
  ProductResearchResult,
  RecommendationExplanationInput,
  ScreenshotAnalysisInput,
} from "@/lib/ai/providers/types";
import type { RecommendationExplanation } from "@/lib/ai/schemas/research";
import {
  zirconDemoExtraction,
  zirconDemoIdentity,
  zirconDemoMarket,
  zirconDemoShipping,
} from "@/lib/demo/zircon";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Demo provider: exercises the entire workflow without API keys or network.
 * Always returns the Zircon fixture, clearly labeled as demo data.
 */
export class DemoProvider implements AIProvider {
  readonly id = "demo" as const;

  async testConnection(): Promise<ConnectionResult> {
    return { ok: true, message: "Demo mode — no provider connection needed.", modelUsed: "demo", keySource: "none" };
  }

  async analyzeScreenshot(_input: ScreenshotAnalysisInput): Promise<ListingExtractionResult> {
    void _input;
    await wait(400);
    return { extraction: zirconDemoExtraction() };
  }

  async researchProduct(_input: ProductResearchInput): Promise<ProductResearchResult> {
    void _input;
    await wait(600);
    return {
      identity: zirconDemoIdentity(),
      market: zirconDemoMarket(),
      shipping: zirconDemoShipping(),
      usedWebResearch: false,
      warnings: ["Demo data, not live market evidence."],
    };
  }

  async classifyComparables(input: ComparableClassificationInput): Promise<ComparableResearchResult> {
    await wait(200);
    return { comparables: input.comparables };
  }

  async explainRecommendation(_input: RecommendationExplanationInput): Promise<RecommendationExplanation> {
    void _input;
    await wait(200);
    return {
      summary:
        "Demo explanation: the conservative scenario clears the $20 profit floor and both ROI floors at the current $1 bid, driven by consistent sold comps in the low-to-mid $30s. The Instant Win price does not leave enough margin after fees and shipping.",
      keyDrivers: [
        "3+ sold comparables near $35 (demo data)",
        "Small, light package keeps shipping cheap",
        "Recognized brand with steady demand",
      ],
      cautions: [
        "Open-box electronics: test scanning modes before listing",
        "SuperScan ID vs SuperScan K variant must be confirmed",
        "Demo data, not live market evidence",
      ],
      protectionAdvice:
        "At roughly $7 on a low-cost, easy-to-test tool, protection is optional; it mainly makes sense if you cannot test before the return window closes.",
    };
  }
}
