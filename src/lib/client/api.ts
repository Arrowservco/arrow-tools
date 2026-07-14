"use client";

import type { AppSettings } from "@/lib/storage/settings";
import { getSessionKey } from "@/lib/storage/settings";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { ProductResearchResult, ConnectionResult } from "@/lib/ai/providers/types";
import type { RecommendationExplanation } from "@/lib/ai/schemas/research";
import {
  zirconDemoExtraction,
  zirconDemoIdentity,
  zirconDemoMarket,
  zirconDemoShipping,
} from "@/lib/demo/zircon";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function providerPayload(settings: AppSettings) {
  return {
    provider: settings.provider,
    apiKey: getSessionKey(settings.provider) || undefined,
    model: settings.model || undefined,
    webResearchEnabled: settings.webResearchEnabled,
    maxResearchCalls: settings.maxResearchCalls,
  };
}

/**
 * Read a fetch Response safely. Never throws on non-JSON bodies (a Netlify/HTML
 * error page must not surface as a cryptic JSON.parse error). Returns the parsed
 * JSON on success, or throws an ApiError carrying the server's message when
 * available, otherwise a clear HTTP-status message.
 */
async function readJson<T>(res: Response, fallbackContext: string): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  let body: unknown = null;
  if (isJson) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    // Drain the body so the connection is released; ignore the text.
    try {
      await res.text();
    } catch {
      /* ignore */
    }
  }

  if (res.ok) {
    if (isJson && body !== null) return body as T;
    throw new ApiError(
      `${fallbackContext}: the server returned an unexpected non-JSON response (HTTP ${res.status}). ` +
        `This usually means the server function isn't running on the host.`,
      "bad_response",
      true,
    );
  }

  // Error path.
  const b = (body ?? {}) as { message?: string; error?: string; retryable?: boolean };
  const message =
    b.message ||
    (res.status === 401
      ? "The API key was rejected (HTTP 401)."
      : res.status === 404
        ? `${fallbackContext}: server route not found (HTTP 404).`
        : res.status === 429
          ? "Rate limit or quota exceeded (HTTP 429)."
          : res.status >= 500
            ? `${fallbackContext}: server error (HTTP ${res.status}).`
            : `${fallbackContext} failed (HTTP ${res.status}).`);
  throw new ApiError(message, b.error || "http_error", b.retryable ?? (res.status >= 500 || res.status === 429));
}

async function postJson<T>(url: string, payload: unknown, context: string, timeoutMs = 90_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return await readJson<T>(res, context);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(`${context} timed out. Try again, or continue with conservative estimates.`, "timeout", true);
    }
    throw new ApiError(`${context}: network error — could not reach the server.`, "network", true);
  } finally {
    clearTimeout(timer);
  }
}

/** True when the app should run entirely in the browser with no network. */
export function isDemo(settings: AppSettings): boolean {
  return settings.provider === "demo";
}

export async function apiExtract(
  settings: AppSettings,
  image: File | null,
): Promise<{ extraction: MacBidScreenshotExtraction; demo: boolean }> {
  // Demo mode runs fully client-side — never touches the network.
  if (isDemo(settings)) {
    return { extraction: zirconDemoExtraction(), demo: true };
  }
  const form = new FormData();
  form.set("provider", JSON.stringify(providerPayload(settings)));
  if (image) form.set("image", image);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch("/api/v1/extract", { method: "POST", body: form, signal: controller.signal });
    return await readJson(res, "Screenshot extraction");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError("Screenshot extraction timed out.", "timeout", true);
    }
    throw new ApiError("Screenshot extraction: could not reach the server.", "network", true);
  } finally {
    clearTimeout(timer);
  }
}

export async function apiResearch(
  settings: AppSettings,
  product: {
    title: string;
    brand: string | null;
    model: string | null;
    upc: string | null;
    mpn: string | null;
    condition: string;
    retailPrice: number | null;
    categoryGuess: string | null;
  },
): Promise<ProductResearchResult> {
  if (isDemo(settings)) {
    return {
      identity: zirconDemoIdentity(),
      market: zirconDemoMarket(),
      shipping: zirconDemoShipping(),
      usedWebResearch: false,
      warnings: ["Demo data, not live market evidence."],
    };
  }
  return postJson<ProductResearchResult>(
    "/api/v1/research",
    { provider: providerPayload(settings), product },
    "Market research",
    120_000,
  );
}

export async function apiExplain(
  settings: AppSettings,
  resultSummary: string,
): Promise<RecommendationExplanation | null> {
  if (isDemo(settings)) return null;
  try {
    const body = await postJson<{ explanation?: RecommendationExplanation }>(
      "/api/v1/explain",
      { provider: providerPayload(settings), resultSummary },
      "Explanation",
      60_000,
    );
    return body.explanation ?? null;
  } catch {
    return null; // explanation is best-effort; never blocks results
  }
}

export async function apiTestConnection(settings: AppSettings): Promise<ConnectionResult> {
  if (isDemo(settings)) {
    return { ok: true, message: "Demo mode — no key needed.", modelUsed: "demo", keySource: "none" };
  }
  return postJson<ConnectionResult>(
    "/api/v1/providers/test",
    providerPayload(settings),
    "Connection test",
    45_000,
  );
}

/** Downscale an image file to a small JPEG data URL for history thumbnails. */
export async function makeThumbnail(file: File | Blob, maxWidth = 160): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxWidth / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}
