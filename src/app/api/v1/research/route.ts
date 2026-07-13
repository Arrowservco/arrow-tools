import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkAuth } from "@/lib/api/auth";
import { providerErrorResponse } from "@/lib/api/errors";
import { buildProvider, providerConfigFromRequest } from "@/lib/api/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  provider: z.unknown(),
  product: z.object({
    title: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    upc: z.string().nullable(),
    mpn: z.string().nullable(),
    condition: z.string(),
    retailPrice: z.number().nullable(),
    categoryGuess: z.string().nullable(),
  }),
});

export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const body = bodySchema.parse(await req.json());
    const config = providerConfigFromRequest(body.provider);
    const provider = buildProvider(config);
    const result = await provider.researchProduct(body.product);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "bad_request", message: e.message }, { status: 400 });
    }
    return providerErrorResponse(e, "Market research failed.");
  }
}
