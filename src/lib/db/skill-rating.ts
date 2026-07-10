/**
 * Career skill ratings, read straight from `player_stats_aggregate`.
 *
 * The aggregate is the single source of truth: it is recalculated by
 * `@/lib/stats/recalc` using the *active* row of `career_skill_rating_calibration`
 * (its fitted `adaptive_k`), so recomputing the rating in the app with the
 * `SKILL_RATING_CONFIG.defaultAdaptiveK` constant would drift from the profile.
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { playerStatsAggregate } from "@/lib/db/schema";
import { findPlayersByRankedinIds } from "@/lib/db/player-identity";
import type { SkillRatingLevelStatus, SkillRatingReliabilityStatus } from "@/lib/stats/compute";

export type CareerSkillRating = {
  skillIndex: number | null;
  skillRating: number | null;
  skillRatingReliability: number | null;
  skillRatingReliabilityStatus: SkillRatingReliabilityStatus | null;
  skillRatingLevelStatus: SkillRatingLevelStatus | null;
};

function num(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Career skill ratings keyed by RankedIn id (aliases resolved). */
export async function loadCareerSkillRatingsByRid(
  rids: string[],
  database: Database = defaultDb,
): Promise<Map<string, CareerSkillRating>> {
  const out = new Map<string, CareerSkillRating>();
  if (rids.length === 0) return out;

  const identities = await findPlayersByRankedinIds(rids, database);
  if (identities.size === 0) return out;

  const playerIds = [...new Set([...identities.values()].map((row) => row.id))];
  const rows = await database
    .select({
      playerId: playerStatsAggregate.playerId,
      skillIndex: playerStatsAggregate.skillIndex,
      skillRating: playerStatsAggregate.skillRating,
      skillRatingReliability: playerStatsAggregate.skillRatingReliability,
      skillRatingReliabilityStatus: playerStatsAggregate.skillRatingReliabilityStatus,
      skillRatingLevelStatus: playerStatsAggregate.skillRatingLevelStatus,
    })
    .from(playerStatsAggregate)
    .where(
      and(
        inArray(playerStatsAggregate.playerId, playerIds),
        eq(playerStatsAggregate.scope, "career"),
        isNull(playerStatsAggregate.seasonId),
      ),
    );

  const byPlayerId = new Map(rows.map((row) => [row.playerId, row]));
  for (const [rid, identity] of identities) {
    const row = byPlayerId.get(identity.id);
    if (!row) continue;
    out.set(rid, {
      skillIndex: num(row.skillIndex),
      skillRating: num(row.skillRating),
      skillRatingReliability: num(row.skillRatingReliability),
      skillRatingReliabilityStatus: row.skillRatingReliabilityStatus,
      skillRatingLevelStatus: row.skillRatingLevelStatus,
    });
  }
  return out;
}
