import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { checkAuth } from "@/lib/api/auth";
import { providerErrorResponse } from "@/lib/api/errors";
import {
  assembleEvaluation,
  buildProvider,
  mergeProfile,
  providerConfigFromRequest,
} from "@/lib/api/orchestrator";
import { saveEvaluation } from "@/lib/api/serverStore";
import { shapeApiResponse } from "@/lib/api/shape";
import type { ListingOverrides } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/v1/evaluate — full pipeline: screenshot -> extraction ->
 * research -> deterministic evaluation. Multipart form fields:
 *   image     screenshot file (optional when provider=demo)
 *   provider  JSON ProviderConfig ({"provider":"demo"} works keyless)
 *   profile   JSON partial SourcingProfile (merged onto Eric Standard)
 *   overrides JSON ListingOverrides
 */
export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const parse = (name: string) => {
      const v = form.get(name);
      return v ? JSON.parse(String(v)) : undefined;
    };
    const config = providerConfigFromRequest(parse("provider") ?? { provider: "demo" });
    const profile = mergeProfile(parse("profile"));
    const overrides = (parse("overrides") ?? {}) as ListingOverrides;
    const provider = buildProvider(config);
    const demo = config.provider === "demo";

    let imageBase64 = "";
    let mimeType: "image/png" | "image/jpeg" | "image/webp" = "image/png";
    if (!demo) {
      const image = form.get("image");
      if (!(image instanceof File)) {
        return NextResponse.json({ error: "missing_image", message: "Attach an image file." }, { status: 400 });
      }
      if (!ACCEPTED.includes(image.type)) {
        return NextResponse.json({ error: "unsupported_image", message: "Use PNG, JPEG, or WebP." }, { status: 415 });
      }
      if (image.size > MAX_BYTES) {
        return NextResponse.json({ error: "image_too_large", message: "Image exceeds the 8 MB limit." }, { status: 413 });
      }
      imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
      mimeType = image.type as typeof mimeType;
    }

    const { extraction } = await provider.analyzeScreenshot({ imageBase64, mimeType });

    let identity = null;
    let market = null;
    let shipping = null;
    let researchFailed = false;
    try {
      const research = await provider.researchProduct({
        title: extraction.product.title.value ?? "Unknown product",
        brand: extraction.product.brand.value,
        model: extraction.product.modelNumber.value,
        upc: extraction.product.upc.value,
        mpn: extraction.product.mpn.value,
        condition: extraction.product.condition.value ?? "unknown",
        retailPrice: extraction.macBid.displayedRetailPrice.value,
        categoryGuess: extraction.product.categoryGuess.value,
      });
      identity = research.identity;
      market = research.market;
      shipping = research.shipping;
    } catch {
      researchFailed = true;
    }

    const result = assembleEvaluation({
      evaluationId: randomUUID(),
      extraction,
      identity,
      market,
      shipping,
      profile,
      overrides,
      demo,
      researchFailed,
    });

    await saveEvaluation({ result, extraction, identity, market, shipping }).catch(() => {});
    return NextResponse.json(shapeApiResponse(result));
  } catch (e) {
    return providerErrorResponse(e, "Evaluation failed.");
  }
}
