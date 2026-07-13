import { NextResponse } from "next/server";
import { ProviderError } from "@/lib/ai/providers/types";

export function providerErrorResponse(e: unknown, fallback: string) {
  if (e instanceof ProviderError) {
    const status =
      e.code === "missing_key" ? 400 : e.code === "invalid_key" ? 401 : e.code === "quota_exceeded" ? 429 : 502;
    return NextResponse.json({ error: e.code, message: e.message, retryable: e.retryable }, { status });
  }
  const message = e instanceof Error ? e.message : fallback;
  return NextResponse.json({ error: "internal", message: message || fallback, retryable: true }, { status: 500 });
}
