import { z } from "zod";
import { createProvider } from "@/lib/ai/providers";
import type { AIProvider, ProviderConfig, ProviderId } from "@/lib/ai/providers/types";
export { assembleEvaluation, mergeProfile, type AssembleArgs } from "@/lib/pipeline";

export const providerConfigSchema = z.object({
  provider: z.enum(["anthropic", "demo"]).catch("demo").default("demo"),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  webResearchEnabled: z.boolean().default(true),
  maxResearchCalls: z.number().int().min(1).max(10).default(3),
});

export function buildProvider(config: ProviderConfig): AIProvider {
  return createProvider(config);
}

export function providerConfigFromRequest(raw: unknown): ProviderConfig {
  const parsed = providerConfigSchema.parse(raw ?? {});
  return {
    provider: parsed.provider as ProviderId,
    apiKey: parsed.apiKey || undefined,
    model: parsed.model || undefined,
    webResearchEnabled: parsed.webResearchEnabled,
    maxResearchCalls: parsed.maxResearchCalls,
  };
}
