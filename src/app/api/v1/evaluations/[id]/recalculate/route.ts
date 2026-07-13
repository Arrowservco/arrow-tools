import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/lib/api/auth";
import { assembleEvaluation, mergeProfile } from "@/lib/api/orchestrator";
import { loadEvaluation, saveEvaluation } from "@/lib/api/serverStore";
import { shapeApiResponse } from "@/lib/api/shape";
import type { ListingOverrides } from "@/lib/pipeline";

/**
 * POST /api/v1/evaluations/:id/recalculate
 * Body: { overrides?: ListingOverrides, profile?: Partial<SourcingProfile> }
 * Re-runs the deterministic calculators with new assumptions — no AI calls.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = checkAuth(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const stored = await loadEvaluation(id);
  if (!stored) {
    return NextResponse.json(
      { error: "not_found", message: "No evaluation with that id in the server store." },
      { status: 404 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const overrides = (body.overrides ?? {}) as ListingOverrides;
  const profile = body.profile ? mergeProfile(body.profile) : stored.result.profile;

  const result = assembleEvaluation({
    evaluationId: id,
    extraction: stored.extraction,
    identity: stored.identity,
    market: stored.market,
    shipping: stored.shipping,
    profile,
    overrides,
    demo: stored.result.demo,
    createdAt: stored.result.createdAt,
  });
  await saveEvaluation({ ...stored, result }).catch(() => {});
  return NextResponse.json(shapeApiResponse(result));
}
