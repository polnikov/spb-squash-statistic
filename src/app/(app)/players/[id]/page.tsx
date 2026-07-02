import { notFound } from "next/navigation";
import { PlayerProfileView } from "@/components/player-profile-view";
import { loadAllLeagues } from "@/lib/db/league";
import { findPlayerByRankedinId } from "@/lib/db/player-identity";
import { resolveProfilePlayerRid } from "@/lib/player-profile";
import { buildPlayerProfileModelFromDb } from "@/lib/player-profile-db";

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { seasonId?: string; divisionId?: string };
}) {
  const leagues = await loadAllLeagues();
  let playerRid = resolveProfilePlayerRid(params.id, leagues);
  if (!playerRid) {
    const linked = await findPlayerByRankedinId(decodeURIComponent(params.id));
    if (linked?.rankedinId) playerRid = resolveProfilePlayerRid(linked.rankedinId, leagues);
  }
  if (!playerRid) notFound();

  const model = await buildPlayerProfileModelFromDb(leagues, playerRid, searchParams);
  if (!model) notFound();

  return <PlayerProfileView model={model} />;
}
