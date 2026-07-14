import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type {
  MarketResearch,
  ProductIdentity,
  RawComparable,
  RecommendationExplanation,
  ShippingResearch,
} from "@/lib/ai/schemas/research";

export type ProviderId = "anthropic" | "demo";

export interface ProviderConfig {
  provider: ProviderId;
  /** Never persisted server-side; falls back to the provider env var when empty. */
  apiKey?: string;
  model?: string;
  webResearchEnabled: boolean;
  /** Upper bound on model calls per evaluation (research phase). */
  maxResearchCalls: number;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
  modelUsed?: string;
  keySource: "user" | "environment" | "none";
}

export interface ScreenshotAnalysisInput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
}

export interface ListingExtractionResult {
  extraction: MacBidScreenshotExtraction;
}

export interface ProductResearchInput {
  title: string;
  brand: string | null;
  model: string | null;
  upc: string | null;
  mpn: string | null;
  condition: string;
  retailPrice: number | null;
  categoryGuess: string | null;
}

export interface ProductResearchResult {
  identity: ProductIdentity;
  market: MarketResearch;
  shipping: ShippingResearch;
  /** True when web research was actually used (vs. model knowledge only). */
  usedWebResearch: boolean;
  warnings: string[];
}

export interface ComparableClassificationInput {
  product: ProductResearchInput;
  comparables: RawComparable[];
}

export interface ComparableResearchResult {
  comparables: RawComparable[];
}

export interface RecommendationExplanationInput {
  /** Compact JSON summary of the deterministic evaluation. */
  resultSummary: string;
}

export interface AIProvider {
  readonly id: ProviderId;
  testConnection(): Promise<ConnectionResult>;
  analyzeScreenshot(input: ScreenshotAnalysisInput): Promise<ListingExtractionResult>;
  researchProduct(input: ProductResearchInput): Promise<ProductResearchResult>;
  classifyComparables(input: ComparableClassificationInput): Promise<ComparableResearchResult>;
  explainRecommendation(input: RecommendationExplanationInput): Promise<RecommendationExplanation>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "missing_key"
      | "invalid_key"
      | "quota_exceeded"
      | "timeout"
      | "schema_validation"
      | "provider_error",
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
