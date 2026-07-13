import OpenAI from "openai";
import { BaseAIProvider, type CompletionOptions } from "@/lib/ai/providers/base";
import { ProviderError, type ConnectionResult, type ProviderConfig } from "@/lib/ai/providers/types";
import { normalizeProviderError } from "@/lib/ai/jsonUtil";

export const OPENAI_DEFAULT_MODEL = "gpt-4o";

export class OpenAIProvider extends BaseAIProvider {
  readonly id = "openai" as const;
  private client: OpenAI;
  private model: string;
  private keySource: "user" | "environment" | "none";

  constructor(config: ProviderConfig) {
    super(config);
    const envKey = process.env.OPENAI_API_KEY;
    const key = config.apiKey || envKey;
    this.keySource = config.apiKey ? "user" : envKey ? "environment" : "none";
    if (!key) {
      throw new ProviderError("No OpenAI API key provided (settings or OPENAI_API_KEY).", "missing_key", false);
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = config.model || OPENAI_DEFAULT_MODEL;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.client.models.list();
      return { ok: true, message: "OpenAI connection OK.", modelUsed: this.model, keySource: this.keySource };
    } catch (e) {
      const err = normalizeProviderError(e);
      return { ok: false, message: err.message, keySource: this.keySource };
    }
  }

  protected async completeText(prompt: string, options: CompletionOptions): Promise<string> {
    if (options.webSearch) {
      // Responses API with the built-in web_search tool.
      const response = await this.client.responses.create({
        model: this.model,
        tools: [{ type: "web_search" }],
        input: prompt,
        max_output_tokens: options.maxTokens ?? 4096,
      });
      return response.output_text;
    }
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: options.maxTokens ?? 4096,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    return response.choices[0]?.message?.content ?? "";
  }

  protected async completeVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
    });
    return response.choices[0]?.message?.content ?? "";
  }
}
