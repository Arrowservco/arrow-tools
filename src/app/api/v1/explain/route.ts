import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkAuth } from "@/lib/api/auth";
import { providerErrorResponse } from "@/lib/api/errors";
import { buildProvider, providerConfigFromRequest } from "@/lib/api/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  provider: z.unknown(),
  resultSummary: z.string().max(50_000),
});

export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const body = bodySchema.parse(await req.json());
    const provider = buildProvider(providerConfigFromRequest(body.provider));
    const explanation = await provider.explainRecommendation({ resultSummary: body.resultSummary });
    return NextResponse.json({ explanation });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "bad_request", message: e.message }, { status: 400 });
    }
    return providerErrorResponse(e, "Explanation failed.");
  }
}
