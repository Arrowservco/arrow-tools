import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "bidlens",
    version: "0.1.0",
    time: new Date().toISOString(),
    provider: "anthropic",
    anthropicKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    apiTokenRequired: Boolean(process.env.BIDLENS_API_TOKEN),
  });
}
