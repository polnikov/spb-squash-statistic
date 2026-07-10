import { Users } from "lucide-react";
import { getPlayersOverview, type PlayerOverview } from "@/lib/league";
import { loadAllLeagues } from "@/lib/db/league";
import { PlayersList } from "@/components/players-list";
import { PageHeader } from "@/components/page-header";
import { playersLabel } from "@/lib/format";
import {
  SKILL_RATING_CONFIG,
  calculateCareerSkillRating,
  calculateSkillIndex,
  getSkillRatingLevelStatus,
  getSkillRatingReliabilityStatus,
} from "@/lib/stats/compute";

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
      const skillRating = calculateCareerSkillRating({
        careerSkillIndex: skillIndex,
        careerMatchesPlayed: matches,
        adaptiveK: SKILL_RATING_CONFIG.defaultAdaptiveK,
      });

      byRid.set(player.rid, {
        ...existing,
        skill: Math.max(existing.skill, player.skill),
        rank: Math.max(existing.rank, player.rank),
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
        skillRating: skillRating.skillRating,
        skillRatingReliability: skillRating.reliability,
        skillRatingReliabilityStatus: getSkillRatingReliabilityStatus(matches),
        skillRatingLevelStatus: getSkillRatingLevelStatus(skillRating.skillRating),
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
