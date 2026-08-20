import { NextResponse } from "next/server";
import { lookupPublicPlayer, parseRankedinIdParam, resolveBaseUrl } from "@/lib/players/public-lookup";

/**
 * GET /api/public/players/lookup?rankedinId=R000064106
 *
 * Read-only contract for third-party apps: given a RankedIn id, say whether the
 * person plays in this league and hand back the link to their profile. A miss
 * is a 200 with `found: false`, not a 404, so the caller parses one shape.
 *
 * Public data, so no key: the same names and profiles are already open on the
 * site. Cached for five minutes at the proxy to keep scrapers off the database.
 */
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const parsed = parseRankedinIdParam(new URL(request.url).searchParams.get("rankedinId"));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400, headers: CORS });
  }

  const baseUrl = resolveBaseUrl(request.headers, process.env.APP_URL);
  const result = await lookupPublicPlayer(parsed.rankedinId, baseUrl);

  return NextResponse.json(result, {
    status: 200,
    headers: { ...CORS, "Cache-Control": CACHE },
  });
}
