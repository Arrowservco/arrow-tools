import Anthropic from "@anthropic-ai/sdk";
import { BaseAIProvider, type CompletionOptions } from "@/lib/ai/providers/base";
import { ProviderError, type ConnectionResult, type ProviderConfig } from "@/lib/ai/providers/types";
import { normalizeProviderError } from "@/lib/ai/jsonUtil";

export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-4-8";

export class AnthropicProvider extends BaseAIProvider {
  readonly id = "anthropic" as const;
  private client: Anthropic;
  private model: string;
  private keySource: "user" | "environment" | "none";

  constructor(config: ProviderConfig) {
    super(config);
    const envKey = process.env.ANTHROPIC_API_KEY;
    const key = config.apiKey || envKey;
    this.keySource = config.apiKey ? "user" : envKey ? "environment" : "none";
    if (!key) {
      throw new ProviderError("No Anthropic API key provided (settings or ANTHROPIC_API_KEY).", "missing_key", false);
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = config.model || ANTHROPIC_DEFAULT_MODEL;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.client.models.list();
      return { ok: true, message: "Anthropic connection OK.", modelUsed: this.model, keySource: this.keySource };
    } catch (e) {
      const err = normalizeProviderError(e);
      return { ok: false, message: err.message, keySource: this.keySource };
    }
  }

  protected async completeText(prompt: string, options: CompletionOptions): Promise<string> {
    const tools = options.webSearch
      ? [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 6 }]
      : undefined;
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens ?? 4096,
      tools,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") {
      throw new ProviderError("The model declined this request.", "provider_error", false);
    }
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  protected async completeVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/png" | "image/jpeg" | "image/webp",
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") {
      throw new ProviderError("The model declined this request.", "provider_error", false);
    }
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
}
