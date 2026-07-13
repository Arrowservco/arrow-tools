import { parseModelJson, normalizeProviderError } from "@/lib/ai/jsonUtil";
import {
  screenshotExtractionPrompt,
  productIdentityPrompt,
  marketResearchPrompt,
  comparableClassificationPrompt,
  shippingResearchPrompt,
  recommendationExplanationPrompt,
} from "@/lib/ai/prompts";
import { macBidScreenshotExtractionSchema } from "@/lib/ai/schemas/extraction";
import {
  marketResearchSchema,
  productIdentitySchema,
  recommendationExplanationSchema,
  shippingResearchSchema,
  rawComparableSchema,
} from "@/lib/ai/schemas/research";
import { z } from "zod";
import type {
  AIProvider,
  ComparableClassificationInput,
  ComparableResearchResult,
  ConnectionResult,
  ListingExtractionResult,
  ProductResearchInput,
  ProductResearchResult,
  ProviderConfig,
  ProviderId,
  RecommendationExplanationInput,
  ScreenshotAnalysisInput,
} from "@/lib/ai/providers/types";
import type { RecommendationExplanation } from "@/lib/ai/schemas/research";

export interface CompletionOptions {
  /** Enable the provider's web search / grounding tool for this call. */
  webSearch: boolean;
  maxTokens?: number;
}

/**
 * Shared orchestration for the three real providers. Subclasses implement the
 * raw model calls; this base class owns prompt assembly, JSON validation, and
 * the research call budget.
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly id: ProviderId;

  constructor(protected readonly config: ProviderConfig) {}

  protected abstract completeText(prompt: string, options: CompletionOptions): Promise<string>;
  protected abstract completeVision(
    prompt: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<string>;
  abstract testConnection(): Promise<ConnectionResult>;

  async analyzeScreenshot(input: ScreenshotAnalysisInput): Promise<ListingExtractionResult> {
    try {
      const raw = await this.completeVision(screenshotExtractionPrompt, input.imageBase64, input.mimeType);
      return { extraction: parseModelJson(raw, macBidScreenshotExtractionSchema) };
    } catch (e) {
      throw normalizeProviderError(e);
    }
  }

  async researchProduct(input: ProductResearchInput): Promise<ProductResearchResult> {
    const warnings: string[] = [];
    const budget = Math.max(1, this.config.maxResearchCalls);
    const web = this.config.webResearchEnabled;
    let callsUsed = 0;
    const productBlock = JSON.stringify(input, null, 2);

    try {
      // Call 1: identity (no web needed unless budget allows).
      callsUsed++;
      const identityRaw = await this.completeText(
        `${productIdentityPrompt}\n\nPRODUCT DATA:\n${productBlock}`,
        { webSearch: web && budget >= 3 },
      );
      const identity = parseModelJson(identityRaw, productIdentitySchema);

      // Call 2: market research (web strongly preferred).
      let market;
      let usedWebResearch = false;
      if (callsUsed < budget) {
        callsUsed++;
        usedWebResearch = web;
        const marketRaw = await this.completeText(
          `${marketResearchPrompt}\n\nPRODUCT DATA:\n${productBlock}`,
          { webSearch: web, maxTokens: 8000 },
        );
        market = parseModelJson(marketRaw, marketResearchSchema);
        if (!web) {
          warnings.push("Web research disabled — market evidence is model recollection only and is treated as low confidence.");
          market.comparables = market.comparables.map((c) => ({
            ...c,
            soldStatus: c.soldStatus === "sold" ? ("unknown" as const) : c.soldStatus,
            relevanceScore: Math.min(c.relevanceScore, 0.5),
          }));
        }
      } else {
        market = emptyMarket();
        warnings.push("Research call budget exhausted before market research.");
      }

      // Call 3: shipping specs.
      let shipping;
      if (callsUsed < budget) {
        callsUsed++;
        const shippingRaw = await this.completeText(
          `${shippingResearchPrompt}\n\nPRODUCT DATA:\n${productBlock}`,
          { webSearch: web },
        );
        shipping = parseModelJson(shippingRaw, shippingResearchSchema);
      } else {
        shipping = {
          itemWeightOz: null,
          packedWeightOz: null,
          packageDimensionsIn: null,
          source: "category_default" as const,
          confidence: 0.2,
          notes: "Research call budget exhausted — using category defaults.",
        };
        warnings.push("Research call budget exhausted before shipping research.");
      }

      return { identity, market, shipping, usedWebResearch, warnings };
    } catch (e) {
      throw normalizeProviderError(e);
    }
  }

  async classifyComparables(input: ComparableClassificationInput): Promise<ComparableResearchResult> {
    try {
      const raw = await this.completeText(
        `${comparableClassificationPrompt}\n\nPRODUCT:\n${JSON.stringify(input.product)}\n\nCANDIDATES:\n${JSON.stringify(
          { comparables: input.comparables },
        )}`,
        { webSearch: false },
      );
      const parsed = parseModelJson(raw, z.object({ comparables: z.array(rawComparableSchema) }));
      return { comparables: parsed.comparables };
    } catch (e) {
      throw normalizeProviderError(e);
    }
  }

  async explainRecommendation(input: RecommendationExplanationInput): Promise<RecommendationExplanation> {
    try {
      const raw = await this.completeText(
        `${recommendationExplanationPrompt}\n\nEVALUATION DATA:\n${input.resultSummary}`,
        { webSearch: false },
      );
      return parseModelJson(raw, recommendationExplanationSchema);
    } catch (e) {
      throw normalizeProviderError(e);
    }
  }
}

function emptyMarket() {
  return {
    comparables: [],
    verifiedRetailPrice: null,
    activeCompetitionEstimate: null,
    brandRecognized: null,
    seasonal: null,
    categoryGuess: null,
    sources: [],
    notes: [],
  };
}
