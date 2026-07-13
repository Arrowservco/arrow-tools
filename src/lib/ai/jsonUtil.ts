import type { z } from "zod";
import { ProviderError } from "@/lib/ai/providers/types";

/**
 * Extract the first JSON object from model output (models occasionally wrap
 * JSON in code fences or preamble despite instructions) and validate it.
 */
export function parseModelJson<T extends z.ZodTypeAny>(raw: string, schema: T): z.infer<T> {
  const candidates: string[] = [];
  const trimmed = raw.trim();
  candidates.push(trimmed);

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error;
    } catch (e) {
      lastError = e;
    }
  }
  throw new ProviderError(
    `Model returned output that failed schema validation: ${String(lastError).slice(0, 400)}`,
    "schema_validation",
    true,
  );
}

/** Map a thrown provider SDK error to a ProviderError with a useful code. */
export function normalizeProviderError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const status =
    typeof e === "object" && e !== null && "status" in e ? Number((e as { status: unknown }).status) : null;
  if (status === 401 || status === 403 || /invalid.*(api|key)|unauthorized/i.test(msg)) {
    return new ProviderError("The API key was rejected by the provider.", "invalid_key", false);
  }
  if (status === 429 || /quota|rate limit/i.test(msg)) {
    return new ProviderError("Provider quota or rate limit exceeded. Wait and retry.", "quota_exceeded", true);
  }
  if (/timeout|timed out|ETIMEDOUT|aborted/i.test(msg)) {
    return new ProviderError("The provider request timed out.", "timeout", true);
  }
  return new ProviderError(`Provider request failed: ${msg.slice(0, 300)}`, "provider_error", true);
}
