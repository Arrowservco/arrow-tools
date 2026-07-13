import type { AIProvider, ProviderConfig } from "@/lib/ai/providers/types";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { GeminiProvider } from "@/lib/ai/providers/gemini";
import { DemoProvider } from "@/lib/ai/providers/demo";

/** Server-side factory. Never call from client code — keys live server-side. */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config);
    case "anthropic":
      return new AnthropicProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "demo":
      return new DemoProvider();
  }
}

export type { AIProvider, ProviderConfig };
