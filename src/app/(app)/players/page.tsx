import { Users } from "lucide-react";
import { getPlayersOverview, type PlayerOverview } from "@/lib/mock/league";
import { loadAllLeagues } from "@/lib/db/league";
import { PlayersList } from "@/components/players-list";
import { PageHeader } from "@/components/page-header";
import { playersLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

function mergePlayersByRid(lists: PlayerOverview[][]): PlayerOverview[] {
  const byRid = new Map<string, PlayerOverview>();

  for (const list of lists) {
    for (const player of list) {
      const existing = byRid.get(player.rid);
      if (!existing) {
        byRid.set(player.rid, {
          ...player,
          divisions: [...player.divisions],
          divisionPlaces: [...player.divisionPlaces],
        });
        continue;
      }

      const divisions = [...new Set([...existing.divisions, ...player.divisions])].sort((a, b) => a - b);
      const places = new Map(existing.divisionPlaces.map((it) => [it.div, it.place]));
      for (const it of player.divisionPlaces) {
        if (!places.has(it.div)) places.set(it.div, it.place);
      }

      byRid.set(player.rid, {
        ...existing,
        skill: Math.max(existing.skill, player.skill),
        rank: Math.max(existing.rank, player.rank),
        divisions,
        divisionPlaces: divisions.map((div) => ({ div, place: places.get(div) ?? null })),
        points: Math.max(existing.points, player.points),
        matches: existing.matches + player.matches,
        winPct: Math.max(existing.winPct, player.winPct),
        skillIndex: Math.max(existing.skillIndex ?? 0, player.skillIndex ?? 0) || null,
      });
    }
  }

  return [...byRid.values()];
}

export default async function PlayersPage() {
  const leagues = await loadAllLeagues();
  const players = mergePlayersByRid(Object.values(leagues).map(getPlayersOverview));

  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PageHeader title="Игроки" subtitle={playersLabel(players.length)} icon={Users} />
      <PlayersList players={players} />
    </div>
  );
}
