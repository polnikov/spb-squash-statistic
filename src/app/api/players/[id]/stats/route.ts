import { NextResponse, type NextRequest } from "next/server";
import { getPlayerCareerStats, getPlayerSeasonStats } from "@/lib/stats/queries";

/**
 * GET /api/players/:id/stats[?seasonId=N]
 * Returns the player's career aggregate, plus the season aggregate when
 * `seasonId` is supplied. 404 when the player has no computed stats yet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const playerId = Number(params.id);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return NextResponse.json({ error: "invalid player id" }, { status: 400 });
  }

  const seasonParam = req.nextUrl.searchParams.get("seasonId");
  let seasonId: number | null = null;
  if (seasonParam !== null) {
    seasonId = Number(seasonParam);
    if (!Number.isInteger(seasonId) || seasonId <= 0) {
      return NextResponse.json({ error: "invalid seasonId" }, { status: 400 });
    }
  }

  const career = await getPlayerCareerStats(playerId);
  if (!career) {
    return NextResponse.json({ error: "stats not found" }, { status: 404 });
  }

  const season = seasonId !== null ? await getPlayerSeasonStats(playerId, seasonId) : undefined;

  return NextResponse.json({ playerId, career, season });
}
