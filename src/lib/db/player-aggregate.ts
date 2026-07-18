/**
 * Career aggregate metrics read from `player_stats_aggregate` (scope = career).
 *
 * These are produced by the stats backfill; the pure league overview builder
 * cannot derive them (they need match-by-match history), so read surfaces fill
 * them here, mirroring how the Strength Rating is attached.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { playerStatsAggregate } from "@/lib/db/schema";
import { findPlayersByRankedinIds } from "@/lib/db/player-identity";

/** Career longest win streak keyed by RankedIn id (aliases resolved). */
export async function loadCareerLongestWinStreakByRid(
  rids: string[],
  database: Database = defaultDb,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (rids.length === 0) return out;

  const identities = await findPlayersByRankedinIds(rids, database);
  if (identities.size === 0) return out;

  const playerIds = [...new Set([...identities.values()].map((row) => row.id))];
  const rows = await database
    .select({
      playerId: playerStatsAggregate.playerId,
      longestWinStreak: playerStatsAggregate.longestWinStreak,
    })
    .from(playerStatsAggregate)
    .where(and(eq(playerStatsAggregate.scope, "career"), inArray(playerStatsAggregate.playerId, playerIds)));

  const byPlayerId = new Map(rows.map((row) => [row.playerId, row.longestWinStreak]));
  for (const [rid, identity] of identities) {
    const streak = byPlayerId.get(identity.id);
    if (streak != null) out.set(rid, streak);
  }
  return out;
}
