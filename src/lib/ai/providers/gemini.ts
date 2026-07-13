import { GoogleGenAI } from "@google/genai";
import { BaseAIProvider, type CompletionOptions } from "@/lib/ai/providers/base";
import { ProviderError, type ConnectionResult, type ProviderConfig } from "@/lib/ai/providers/types";
import { normalizeProviderError } from "@/lib/ai/jsonUtil";

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export class GeminiProvider extends BaseAIProvider {
  readonly id = "gemini" as const;
  private client: GoogleGenAI;
  private model: string;
  private keySource: "user" | "environment" | "none";

  constructor(config: ProviderConfig) {
    super(config);
    const envKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const key = config.apiKey || envKey;
    this.keySource = config.apiKey ? "user" : envKey ? "environment" : "none";
    if (!key) {
      throw new ProviderError(
        "No Google Gemini API key provided (settings or GOOGLE_GENERATIVE_AI_API_KEY).",
        "missing_key",
        false,
      );
    }
    this.client = new GoogleGenAI({ apiKey: key });
    this.model = config.model || GEMINI_DEFAULT_MODEL;
  }

  async testConnection(): Promise<ConnectionResult> {
    try {
      await this.client.models.list();
      return { ok: true, message: "Gemini connection OK.", modelUsed: this.model, keySource: this.keySource };
    } catch (e) {
      const err = normalizeProviderError(e);
      return { ok: false, message: err.message, keySource: this.keySource };
    }
  }

  protected async completeText(prompt: string, options: CompletionOptions): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: options.maxTokens ?? 4096,
        tools: options.webSearch ? [{ googleSearch: {} }] : undefined,
      },
    });
    return response.text ?? "";
  }

  protected async completeVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt }],
        },
      ],
      config: { maxOutputTokens: 4096 },
    });
    return response.text ?? "";
  }
}
