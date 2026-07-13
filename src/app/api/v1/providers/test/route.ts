import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/lib/api/auth";
import { buildProvider, providerConfigFromRequest } from "@/lib/api/orchestrator";
import { ProviderError } from "@/lib/ai/providers/types";

export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const config = providerConfigFromRequest(body);
    const provider = buildProvider(config);
    const result = await provider.testConnection();
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json(
        { ok: false, message: e.message, code: e.code, keySource: "none" },
        { status: e.code === "missing_key" ? 400 : 502 },
      );
    }
    return NextResponse.json({ ok: false, message: "Provider test failed.", keySource: "none" }, { status: 500 });
  }
}
