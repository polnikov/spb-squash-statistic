import { getPlayersOverview, type PlayerOverview } from "@/lib/league";
import { loadAllLeagues } from "@/lib/db/league";
import { loadCareerStrengthRatingsByRid } from "@/lib/db/strength-rating";
import { PlayersList } from "@/components/players-list";
import { calculateSkillIndex } from "@/lib/stats/compute";

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
      const matches = existing.matches + player.matches;
      const matchesWon = existing.matchesWon + player.matchesWon;
      const matchesLost = existing.matchesLost + player.matchesLost;
      const games = existing.games + player.games;
      const gamesWon = existing.gamesWon + player.gamesWon;
      const gamesLost = existing.gamesLost + player.gamesLost;
      const rallies = existing.rallies + player.rallies;
      const ralliesWon = existing.ralliesWon + player.ralliesWon;
      const ralliesLost = existing.ralliesLost + player.ralliesLost;
      const matchWinRatePct = matches ? (matchesWon / matches) * 100 : 0;
      const gameWinRatePct = games ? (gamesWon / games) * 100 : null;
      const rallyWinRatePct = rallies ? (ralliesWon / rallies) * 100 : null;
      const skillIndex = calculateSkillIndex({ matchWinRatePct, gameWinRatePct, rallyWinRatePct });

      byRid.set(player.rid, {
        ...existing,
        skill: Math.max(existing.skill, player.skill),
        rankSkill: Math.max(existing.rankSkill, player.rankSkill),
        divisions,
        divisionPlaces: divisions.map((div) => ({ div, place: places.get(div) ?? null })),
        points: Math.max(existing.points, player.points),
        matches,
        matchesWon,
        matchesLost,
        winPct: matchWinRatePct,
        games,
        gamesWon,
        gamesLost,
        gameWinRatePct,
        rallies,
        ralliesWon,
        ralliesLost,
        rallyWinRatePct,
        rallyBalancePerMatch: matches ? (ralliesWon - ralliesLost) / matches : null,
        skillIndex,
        careerSkillIndex: skillIndex,
        strengthRating: null,
        strengthRatingGames: 0,
      });
    }
  }

  return [...byRid.values()];
}

/**
 * Attach each player's Strength Rating (Elo) from `players`. The overview
 * builder cannot compute Elo (it is global across players), so the rating and
 * its game count are filled here; players without a stored rating stay null/0.
 */
function applyStoredStrengthRatings(
  players: PlayerOverview[],
  stored: Awaited<ReturnType<typeof loadCareerStrengthRatingsByRid>>,
): PlayerOverview[] {
  return players.map((player) => {
    const row = stored.get(player.rid);
    if (!row) return player;
    return {
      ...player,
      strengthRating: row.strengthRating,
      strengthRatingGames: row.strengthRatingGames,
    };
  });
}

export default async function PlayersPage() {
  const leagues = await loadAllLeagues();
  const merged = mergePlayersByRid(Object.values(leagues).map(getPlayersOverview));
  const stored = await loadCareerStrengthRatingsByRid(merged.map((p) => p.rid));
  const players = applyStoredStrengthRatings(merged, stored);

  return (
    <div className="flex flex-col gap-3 md:gap-8">
      <PlayersList players={players} title="Игроки" />
    </div>
  );
}
