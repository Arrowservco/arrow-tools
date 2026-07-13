"use client";

import type { AppSettings } from "@/lib/storage/settings";
import { getSessionKey } from "@/lib/storage/settings";
import type { MacBidScreenshotExtraction } from "@/lib/ai/schemas/extraction";
import type { ProductResearchResult, ConnectionResult } from "@/lib/ai/providers/types";
import type { RecommendationExplanation } from "@/lib/ai/schemas/research";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
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

async function parseError(res: Response): Promise<never> {
  let message = `Request failed (${res.status}).`;
  let code = "http_error";
  let retryable = res.status >= 500 || res.status === 429;
  try {
    const body = await res.json();
    if (body.message) message = body.message;
    if (body.error) code = body.error;
    if (typeof body.retryable === "boolean") retryable = body.retryable;
  } catch {
    // keep defaults
  }
  throw new ApiError(message, code, retryable);
}

export async function apiExtract(
  settings: AppSettings,
  image: File | null,
): Promise<{ extraction: MacBidScreenshotExtraction; demo: boolean }> {
  const form = new FormData();
  form.set("provider", JSON.stringify(providerPayload(settings)));
  if (image) form.set("image", image);
  const res = await fetch("/api/v1/extract", { method: "POST", body: form });
  if (!res.ok) await parseError(res);
  return res.json();
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
  const res = await fetch("/api/v1/research", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: providerPayload(settings), product }),
  });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function apiExplain(
  settings: AppSettings,
  resultSummary: string,
): Promise<RecommendationExplanation | null> {
  try {
    const res = await fetch("/api/v1/explain", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: providerPayload(settings), resultSummary }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.explanation ?? null;
  } catch {
    return null;
  }
}

export async function apiTestConnection(settings: AppSettings): Promise<ConnectionResult> {
  const res = await fetch("/api/v1/providers/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(providerPayload(settings)),
  });
  if (!res.ok && res.status >= 500) await parseError(res);
  return res.json();
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
