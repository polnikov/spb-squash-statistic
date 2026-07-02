/**
 * Read layer for denormalized player statistics. Server-side helpers that the
 * App Router pages and API routes use to fetch aggregates. Numeric cache
 * columns come back from Drizzle as strings; these helpers parse them into
 * numbers (or null) for consumers.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db as defaultDb, type Database } from "@/lib/db";
import {
  players,
  playerMetricSeriesPoint,
  playerOpponentStats,
  playerStatsAggregate,
  type PlayerMetricSeriesPointRow,
  type PlayerOpponentStatsRow,
  type PlayerStatsAggregateRow,
} from "@/lib/db/schema";
import { findPlayerByRankedinId } from "@/lib/db/player-identity";

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

/** Aggregate with numeric caches parsed to numbers, for API/UI consumers. */
export type PlayerStats = Omit<
  PlayerStatsAggregateRow,
  | "matchWinRatePct"
  | "gameWinRatePct"
  | "rallyWinRatePct"
  | "gameBalancePerMatch"
  | "rallyBalancePerMatch"
  | "cleanWinRatePct"
  | "cleanLossRatePct"
> & {
  matchWinRatePct: number | null;
  gameWinRatePct: number | null;
  rallyWinRatePct: number | null;
  gameBalancePerMatch: number | null;
  rallyBalancePerMatch: number | null;
  cleanWinRatePct: number | null;
  cleanLossRatePct: number | null;
};

export function mapStatsRow(row: PlayerStatsAggregateRow): PlayerStats {
  return {
    ...row,
    matchWinRatePct: num(row.matchWinRatePct),
    gameWinRatePct: num(row.gameWinRatePct),
    rallyWinRatePct: num(row.rallyWinRatePct),
    gameBalancePerMatch: num(row.gameBalancePerMatch),
    rallyBalancePerMatch: num(row.rallyBalancePerMatch),
    cleanWinRatePct: num(row.cleanWinRatePct),
    cleanLossRatePct: num(row.cleanLossRatePct),
  };
}

export async function getPlayerCareerStats(
  playerId: number,
  database: Database = defaultDb,
): Promise<PlayerStats | null> {
  const [row] = await database
    .select()
    .from(playerStatsAggregate)
    .where(
      and(eq(playerStatsAggregate.playerId, playerId), eq(playerStatsAggregate.scope, "career")),
    )
    .limit(1);
  return row ? mapStatsRow(row) : null;
}

export async function getPlayerSeasonStats(
  playerId: number,
  seasonId: number,
  database: Database = defaultDb,
): Promise<PlayerStats | null> {
  const [row] = await database
    .select()
    .from(playerStatsAggregate)
    .where(
      and(
        eq(playerStatsAggregate.playerId, playerId),
        eq(playerStatsAggregate.scope, "season"),
        eq(playerStatsAggregate.seasonId, seasonId),
      ),
    )
    .limit(1);
  return row ? mapStatsRow(row) : null;
}

export async function getPlayerStageStats(
  playerId: number,
  stageId: number,
  database: Database = defaultDb,
): Promise<PlayerStats | null> {
  const [row] = await database
    .select()
    .from(playerStatsAggregate)
    .where(
      and(
        eq(playerStatsAggregate.playerId, playerId),
        eq(playerStatsAggregate.scope, "stage"),
        eq(playerStatsAggregate.stageId, stageId),
      ),
    )
    .limit(1);
  return row ? mapStatsRow(row) : null;
}

/** All players' stage aggregates for one stage (leaderboard source). */
export async function getStageStats(
  stageId: number,
  database: Database = defaultDb,
): Promise<PlayerStats[]> {
  const rows = await database
    .select()
    .from(playerStatsAggregate)
    .where(
      and(eq(playerStatsAggregate.scope, "stage"), eq(playerStatsAggregate.stageId, stageId)),
    );
  return rows.map(mapStatsRow);
}

/** A player's head-to-head rows against every opponent, most-met first. */
export async function getPlayerOpponentStats(
  playerId: number,
  database: Database = defaultDb,
): Promise<PlayerOpponentStatsRow[]> {
  return database
    .select()
    .from(playerOpponentStats)
    .where(eq(playerOpponentStats.playerId, playerId))
    .orderBy(desc(playerOpponentStats.meetingsPlayed));
}

/** Resolve the internal player id from a RankedIn id. */
export async function getPlayerIdByRid(
  rid: string,
  database: Database = defaultDb,
): Promise<number | null> {
  const row = await findPlayerByRankedinId(rid, database);
  return row?.id ?? null;
}

/** Matchup summary per opponent, keyed by the opponent's RankedIn id (for UI). */
export type MatchupView = {
  opponentRid: string | null;
  meetingsPlayed: number;
  matchupComfortIndex: number | null;
  matchupStatus: string | null;
  sampleSizeLevel: string | null;
  hasClosingProblem: boolean;
  hasPositiveTrend: boolean;
  isHighLoad: boolean;
};

export async function getPlayerMatchups(
  playerId: number,
  database: Database = defaultDb,
): Promise<MatchupView[]> {
  const opp = alias(players, "opp");
  const rows = await database
    .select({
      opponentRid: opp.rankedinId,
      meetingsPlayed: playerOpponentStats.meetingsPlayed,
      matchupComfortIndex: playerOpponentStats.matchupComfortIndex,
      matchupStatus: playerOpponentStats.matchupStatus,
      sampleSizeLevel: playerOpponentStats.sampleSizeLevel,
      hasClosingProblem: playerOpponentStats.hasClosingProblemVsOpponent,
      hasPositiveTrend: playerOpponentStats.hasPositiveTrendVsOpponent,
      isHighLoad: playerOpponentStats.isHighLoadOpponent,
    })
    .from(playerOpponentStats)
    .innerJoin(opp, eq(playerOpponentStats.opponentId, opp.id))
    .where(eq(playerOpponentStats.playerId, playerId));

  return rows.map((r) => ({ ...r, matchupComfortIndex: num(r.matchupComfortIndex) }));
}

export type SeriesPoint = { orderIndex: number; label: string; value: number };

/** A player's chart series for one metric within one season, ordered by stage. */
export async function getPlayerSeries(
  playerId: number,
  metricKey: PlayerMetricSeriesPointRow["metricKey"],
  seasonId: number,
  database: Database = defaultDb,
): Promise<SeriesPoint[]> {
  const rows = await database
    .select({
      orderIndex: playerMetricSeriesPoint.orderIndex,
      label: playerMetricSeriesPoint.label,
      value: playerMetricSeriesPoint.value,
    })
    .from(playerMetricSeriesPoint)
    .where(
      and(
        eq(playerMetricSeriesPoint.playerId, playerId),
        eq(playerMetricSeriesPoint.metricKey, metricKey),
        eq(playerMetricSeriesPoint.seasonId, seasonId),
      ),
    )
    .orderBy(asc(playerMetricSeriesPoint.orderIndex));
  return rows.map((r) => ({ orderIndex: r.orderIndex, label: r.label, value: Number(r.value) }));
}
