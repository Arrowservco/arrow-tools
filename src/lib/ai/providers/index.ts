import { ProviderError, type AIProvider, type ProviderConfig } from "@/lib/ai/providers/types";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { DemoProvider } from "@/lib/ai/providers/demo";

/**
 * Server-side factory. Anthropic is the only live AI provider; Demo runs the
 * bundled Zircon fixture with no key. Never call from client code — keys live
 * server-side.
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "demo":
      return new DemoProvider();
    default:
      throw new ProviderError(
        `Provider "${config.provider}" is not supported. This build uses Anthropic only.`,
        "provider_error",
        false,
      );
  }
}

export type { AIProvider, ProviderConfig };
