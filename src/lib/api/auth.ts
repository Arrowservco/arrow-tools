import { NextResponse, type NextRequest } from "next/server";

/**
 * External calls authenticate with `Authorization: Bearer ${BIDLENS_API_TOKEN}`.
 * Same-origin browser calls (the app's own UI) are allowed without the token.
 * When BIDLENS_API_TOKEN is unset (local development), all calls are allowed.
 */
export function checkAuth(req: NextRequest): NextResponse | null {
  const token = process.env.BIDLENS_API_TOKEN;
  if (!token) return null;

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${token}`) return null;

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return null;
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && origin.replace(/^https?:\/\//, "") === host) return null;

  return NextResponse.json(
    { error: "unauthorized", message: "Provide Authorization: Bearer <BIDLENS_API_TOKEN>." },
    { status: 401 },
  );
}
