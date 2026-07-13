import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/lib/api/auth";
import { buildProvider, providerConfigFromRequest } from "@/lib/api/orchestrator";
import { providerErrorResponse } from "@/lib/api/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const denied = checkAuth(req);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const configRaw = form.get("provider");
    const config = providerConfigFromRequest(configRaw ? JSON.parse(String(configRaw)) : {});
    const provider = buildProvider(config);

    if (config.provider === "demo") {
      const { extraction } = await provider.analyzeScreenshot({ imageBase64: "", mimeType: "image/png" });
      return NextResponse.json({ extraction, demo: true });
    }

    const image = form.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "missing_image", message: "Attach an image file." }, { status: 400 });
    }
    if (!ACCEPTED.includes(image.type as (typeof ACCEPTED)[number])) {
      return NextResponse.json(
        { error: "unsupported_image", message: "Use PNG, JPEG, or WebP." },
        { status: 415 },
      );
    }
    if (image.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "image_too_large", message: "Image exceeds the 8 MB limit." },
        { status: 413 },
      );
    }
    const buffer = Buffer.from(await image.arrayBuffer());
    const { extraction } = await provider.analyzeScreenshot({
      imageBase64: buffer.toString("base64"),
      mimeType: image.type as (typeof ACCEPTED)[number],
    });
    return NextResponse.json({ extraction, demo: false });
  } catch (e) {
    return providerErrorResponse(e, "Screenshot extraction failed.");
  }
}
