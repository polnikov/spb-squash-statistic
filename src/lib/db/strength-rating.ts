/**
 * Career Strength Ratings (Elo), read straight from the `players` table.
 *
 * The rating is maintained by the global chronological engine
 * (`@/lib/stats/strength-rating`) and cached on `players.strength_rating*`, so
 * every read surface (players list, leaderboard) shares one source of truth.
 */

import { inArray } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { players } from "@/lib/db/schema";
import { findPlayersByRankedinIds } from "@/lib/db/player-identity";

export type CareerStrengthRating = {
  strengthRating: number | null;
  strengthRatingGames: number;
};

/** Career Strength Ratings keyed by RankedIn id (aliases resolved). */
export async function loadCareerStrengthRatingsByRid(
  rids: string[],
  database: Database = defaultDb,
): Promise<Map<string, CareerStrengthRating>> {
  const out = new Map<string, CareerStrengthRating>();
  if (rids.length === 0) return out;

  const identities = await findPlayersByRankedinIds(rids, database);
  if (identities.size === 0) return out;

  const playerIds = [...new Set([...identities.values()].map((row) => row.id))];
  const rows = await database
    .select({
      id: players.id,
      strengthRating: players.strengthRating,
      strengthRatingGames: players.strengthRatingGames,
    })
    .from(players)
    .where(inArray(players.id, playerIds));

  const byPlayerId = new Map(rows.map((row) => [row.id, row]));
  for (const [rid, identity] of identities) {
    const row = byPlayerId.get(identity.id);
    if (!row) continue;
    out.set(rid, {
      strengthRating: row.strengthRating,
      strengthRatingGames: row.strengthRatingGames,
    });
  }
  return out;
}
