import { NextResponse } from "next/server";
import { loadAllLeagues } from "@/lib/db/league";
import {
  buildPlayerProfileModel,
  profileResponseFromModel,
  resolveProfilePlayerRid,
} from "@/lib/player-profile";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(request.url);
  const leagues = await loadAllLeagues();
  const playerRid = resolveProfilePlayerRid(params.id, leagues);
  if (!playerRid) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const model = buildPlayerProfileModel(leagues, playerRid, {
    seasonId: url.searchParams.get("seasonId"),
    divisionId: url.searchParams.get("divisionId"),
  });
  if (!model) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json(profileResponseFromModel(model));
}
