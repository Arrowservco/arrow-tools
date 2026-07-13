import { z } from "zod";

export const identityMatchLevelEnum = z.enum([
  "exact_match",
  "probable_match",
  "possible_match",
  "ambiguous",
  "no_reliable_match",
]);

export const productCandidateSchema = z.object({
  productName: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  matchConfidence: z.number().min(0).max(1),
  whyItMayMatch: z.string(),
  importantDifferences: z.string().nullable(),
});

export const productIdentitySchema = z.object({
  matchLevel: identityMatchLevelEnum,
  identityConfidence: z.number().min(0).max(1),
  resolvedBy: z.enum([
    "upc",
    "mpn",
    "model_number",
    "brand_model_phrase",
    "title",
    "image_similarity",
    "category_specs",
    "none",
  ]),
  candidates: z.array(productCandidateSchema).max(3),
  notes: z.string().nullable(),
});
export type ProductIdentity = z.infer<typeof productIdentitySchema>;

export const rawComparableSchema = z.object({
  sourceTitle: z.string(),
  sourceUrl: z.string().nullable(),
  price: z.number().nullable(),
  shippingPrice: z.number().nullable(),
  condition: z.string().nullable(),
  dateText: z.string().nullable(),
  soldStatus: z.enum(["sold", "active", "unknown"]),
  exactModelMatch: z.boolean(),
  accessoryMatch: z.boolean(),
  quantityMatch: z.boolean(),
  relevanceScore: z.number().min(0).max(1),
  exclusionReason: z.string().nullable(),
});
export type RawComparable = z.infer<typeof rawComparableSchema>;

export const marketResearchSchema = z.object({
  comparables: z.array(rawComparableSchema),
  verifiedRetailPrice: z.number().nullable(),
  activeCompetitionEstimate: z.number().nullable(),
  brandRecognized: z.boolean().nullable(),
  seasonal: z.boolean().nullable(),
  categoryGuess: z.string().nullable(),
  sources: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable(),
      kind: z.enum(["sold_listing", "active_listing", "retailer", "manufacturer", "other"]),
      note: z.string().nullable().optional(),
    }),
  ),
  notes: z.array(z.string()).catch([]),
});
export type MarketResearch = z.infer<typeof marketResearchSchema>;

export const shippingResearchSchema = z.object({
  itemWeightOz: z.number().nullable(),
  packedWeightOz: z.number().nullable(),
  packageDimensionsIn: z
    .object({ l: z.number(), w: z.number(), h: z.number() })
    .nullable(),
  source: z.enum(["manufacturer_spec", "product_spec", "comparable_listing", "category_default"]),
  confidence: z.number().min(0).max(1),
  notes: z.string().nullable(),
});
export type ShippingResearch = z.infer<typeof shippingResearchSchema>;

export const recommendationExplanationSchema = z.object({
  summary: z.string(),
  keyDrivers: z.array(z.string()),
  cautions: z.array(z.string()),
  protectionAdvice: z.string().nullable(),
});
export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>;
