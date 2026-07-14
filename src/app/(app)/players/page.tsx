import { currentSeasonOf, getPlayersOverview, seasonStart, type PlayerOverview } from "@/lib/league";
import { loadAllLeagues } from "@/lib/db/league";
import { loadCareerStrengthRatingsByRid } from "@/lib/db/strength-rating";
import { PlayersList } from "@/components/players-list";
import { PlayerAvatarProvider } from "@/components/player-avatar";
import { getPlayerAvatarsByRid } from "@/lib/db/player-avatar-db";
import { calculateSkillIndex } from "@/lib/stats/compute";

export const dynamic = "force-dynamic";

/**
 * Merge the per-season overviews into one career row per player.
 *
 * Totals accumulate and `divisions` stays the union (the division tabs filter on
 * it). `divisionPlaces` is not merged here: it belongs to the current season only
 * and is filled afterwards by `applyCurrentSeasonPlaces`.
 */
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
        divisionPlaces: [...player.divisionPlaces],
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
 * The division badge on a card states where the player stands *now*, so it is
 * taken from the current season alone. A player who sits out this season carries
 * no badge rather than an old standing that no longer holds.
 */
function applyCurrentSeasonPlaces(players: PlayerOverview[], current: PlayerOverview[] | undefined): PlayerOverview[] {
  const placesByRid = new Map((current ?? []).map((p) => [p.rid, p.divisionPlaces]));
  return players.map((player) => ({ ...player, divisionPlaces: placesByRid.get(player.rid) ?? [] }));
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
  const bySeasonAsc = Object.entries(leagues)
    .sort(([a], [b]) => seasonStart(a) - seasonStart(b))
    .map(([, league]) => getPlayersOverview(league));
  const currentSeason = currentSeasonOf(leagues);
  const currentOverview = currentSeason ? getPlayersOverview(leagues[currentSeason]) : undefined;

  const merged = applyCurrentSeasonPlaces(mergePlayersByRid(bySeasonAsc), currentOverview);
  const stored = await loadCareerStrengthRatingsByRid(merged.map((p) => p.rid));
  const players = applyStoredStrengthRatings(merged, stored);
  const avatars = await getPlayerAvatarsByRid();

  return (
    <PlayerAvatarProvider avatars={avatars}>
      <div className="flex flex-col gap-3 md:gap-8">
        <PlayersList players={players} title="Игроки" />
      </div>
    </PlayerAvatarProvider>
  );
}
