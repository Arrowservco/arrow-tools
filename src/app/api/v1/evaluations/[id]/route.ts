import { NextResponse, type NextRequest } from "next/server";
import { checkAuth } from "@/lib/api/auth";
import { loadEvaluation } from "@/lib/api/serverStore";
import { shapeApiResponse } from "@/lib/api/shape";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
  return NextResponse.json(shapeApiResponse(stored.result));
}
