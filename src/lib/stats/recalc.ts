/**
 * DB-facing statistics recalculation. Maps matches + match_games into the pure
 * core (compute.ts) and writes denormalized rows into player_stats_aggregate.
 *
 * Phase 1: career / season / stage aggregates plus match_games backfill.
 * Head-to-head (PlayerOpponentStats) and composite indexes are later phases.
 */

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import {
  matchGames,
  matches,
  careerSkillRatingCalibration,
  playerMetricSeriesPoint,
  playerOpponentStats,
  playerStatsAggregate,
  stages,
  type NewMatchGame,
  type NewPlayerMetricSeriesPoint,
  type NewPlayerOpponentStats,
  type NewPlayerStatsAggregate,
} from "@/lib/db/schema";
import {
  classifyMatchup,
  calculateCareerSkillRating,
  computeAggregate,
  gameFlags,
  getSkillRatingLevelStatus,
  getSkillRatingReliabilityStatus,
  SKILL_RATING_CONFIG,
  perspective,
  recentForm,
  sampleSizeLevel,
  type ComputedAggregate,
  type GamePair,
  type MatchForStats,
  type MatchPerspective,
} from "./compute";
import { calibrateCareerSkillRatingK } from "./skill-rating";

/** Serialize a nullable number for a Drizzle `numeric` column. */
function num3(n: number | null): string | null {
  return n === null ? null : n.toFixed(3);
}

type ActiveSkillRatingCalibration = {
  version: number | null;
  adaptiveK: number;
};

async function loadActiveSkillRatingCalibration(database: Database): Promise<ActiveSkillRatingCalibration> {
  const [row] = await database
    .select({
      version: careerSkillRatingCalibration.version,
      adaptiveK: careerSkillRatingCalibration.adaptiveK,
    })
    .from(careerSkillRatingCalibration)
    .where(eq(careerSkillRatingCalibration.isActive, true))
    .orderBy(desc(careerSkillRatingCalibration.version))
    .limit(1);
  return {
    version: row?.version ?? null,
    adaptiveK: row?.adaptiveK ?? SKILL_RATING_CONFIG.defaultAdaptiveK,
  };
}

export async function recalibrateCareerSkillRating(database: Database = defaultDb): Promise<void> {
  const [previous] = await database
    .select()
    .from(careerSkillRatingCalibration)
    .where(eq(careerSkillRatingCalibration.isActive, true))
    .orderBy(desc(careerSkillRatingCalibration.version))
    .limit(1);

  const rows = (await database
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      gamesA: matches.gamesA,
      gamesB: matches.gamesB,
      scoreDetail: matches.scoreDetail,
      durationMinutes: matches.durationMinutes,
      stageId: matches.stageId,
      stageNumber: stages.number,
      division: matches.division,
      seasonId: stages.seasonId,
      date: stages.date,
    })
    .from(matches)
    .innerJoin(stages, eq(matches.stageId, stages.id))) as JoinedMatch[];

  const byPlayer = new Map<number, MatchPerspective[]>();
  for (const row of rows) {
    (byPlayer.get(row.playerAId) ?? byPlayer.set(row.playerAId, []).get(row.playerAId)!).push(toPerspective(row, row.playerAId));
    (byPlayer.get(row.playerBId) ?? byPlayer.set(row.playerBId, []).get(row.playerBId)!).push(toPerspective(row, row.playerBId));
  }

  const result = calibrateCareerSkillRatingK({
    inputs: [...byPlayer.entries()].map(([playerId, perspectives]) => ({ playerId, perspectives })),
    previousApprovedK: previous?.adaptiveK ?? null,
  });

  if (previous && result.kSource !== "empirical") return;

  await database.transaction(async (tx) => {
    await tx
      .update(careerSkillRatingCalibration)
      .set({ isActive: false })
      .where(eq(careerSkillRatingCalibration.isActive, true));
    await tx.insert(careerSkillRatingCalibration).values({
      version: (previous?.version ?? 0) + 1,
      adaptiveK: result.adaptiveK,
      rawOptimalK: result.rawOptimalK,
      baseline: "50.000",
      kSource: result.kSource,
      calibrationPlayersCount: result.calibrationPlayersCount,
      calibrationMatchesCount: result.calibrationMatchesCount,
      weightedMse: result.weightedMse === null ? null : result.weightedMse.toFixed(6),
      algorithmVersion: "career-skill-rating-v1",
      isActive: true,
    });
  });
}

type JoinedMatch = {
  id: number;
  playerAId: number;
  playerBId: number;
  gamesA: number;
  gamesB: number;
  scoreDetail: GamePair[] | null;
  durationMinutes: number | null;
  stageId: number;
  stageNumber: number;
  division: number;
  seasonId: number;
  date: string | null;
};

function loadPlayerMatches(database: Database, playerId: number) {
  return database
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      gamesA: matches.gamesA,
      gamesB: matches.gamesB,
      scoreDetail: matches.scoreDetail,
      durationMinutes: matches.durationMinutes,
      stageId: matches.stageId,
      stageNumber: stages.number,
      division: matches.division,
      seasonId: stages.seasonId,
      date: stages.date,
    })
    .from(matches)
    .innerJoin(stages, eq(matches.stageId, stages.id))
    .where(or(eq(matches.playerAId, playerId), eq(matches.playerBId, playerId)));
}

/** Distinct division count over a set of matches. */
function divisionCount(rows: JoinedMatch[]): number {
  return new Set(rows.map((r) => r.division)).size;
}

function toPerspective(row: JoinedMatch, playerId: number): MatchPerspective {
  const asA = row.playerAId === playerId;
  const match: MatchForStats = {
    gamesA: row.gamesA,
    gamesB: row.gamesB,
    games: row.scoreDetail ?? [],
    durationSec: row.durationMinutes != null ? row.durationMinutes * 60 : 0,
    playedAt: row.date ? new Date(row.date) : null,
  };
  return perspective(match, asA);
}

function aggregateRow(
  playerId: number,
  scope: "career" | "season" | "season_division" | "stage" | "stage_division",
  seasonId: number | null,
  stageId: number | null,
  division: number | null,
  c: ComputedAggregate,
  seasonsPlayed: number,
  stagesPlayed: number,
  divisionsPlayed: number,
  calibration: ActiveSkillRatingCalibration,
): NewPlayerStatsAggregate {
  const isCareer = scope === "career";
  const rating = isCareer
    ? calculateCareerSkillRating({
        careerSkillIndex: c.skillIndex,
        careerMatchesPlayed: c.matchesPlayed,
        adaptiveK: calibration.adaptiveK,
      })
    : { skillRating: null, reliability: null };
  const ratingLevel = getSkillRatingLevelStatus(rating.skillRating);
  return {
    playerId,
    scope,
    seasonId,
    stageId,
    division,
    seasonsPlayed,
    stagesPlayed,
    divisionsPlayed,
    matchesPlayed: c.matchesPlayed,
    matchesWon: c.matchesWon,
    matchesLost: c.matchesLost,
    gamesPlayed: c.gamesPlayed,
    gamesWon: c.gamesWon,
    gamesLost: c.gamesLost,
    ralliesPlayed: c.ralliesPlayed,
    ralliesWon: c.ralliesWon,
    ralliesLost: c.ralliesLost,
    firstMatchAt: c.firstMatchAt,
    lastMatchAt: c.lastMatchAt,
    matchWinRatePct: num3(c.matchWinRatePct),
    gameWinRatePct: num3(c.gameWinRatePct),
    rallyWinRatePct: num3(c.rallyWinRatePct),
    gameBalance: c.gameBalance,
    rallyBalance: c.rallyBalance,
    gameBalancePerMatch: num3(c.gameBalancePerMatch),
    rallyBalancePerMatch: num3(c.rallyBalancePerMatch),
    wins3_0: c.wins3_0,
    wins3_1: c.wins3_1,
    wins3_2: c.wins3_2,
    losses2_3: c.losses2_3,
    losses1_3: c.losses1_3,
    losses0_3: c.losses0_3,
    cleanWins: c.cleanWins,
    cleanLosses: c.cleanLosses,
    cleanWinRatePct: num3(c.cleanWinRatePct),
    cleanLossRatePct: num3(c.cleanLossRatePct),

    fiveGameMatches: c.fiveGameMatches,
    fiveGameMatchesWon: c.fiveGameMatchesWon,
    fiveGameMatchesLost: c.fiveGameMatchesLost,
    fiveGameMatchRatePct: num3(c.fiveGameMatchRatePct),
    fiveGameWinRatePct: num3(c.fiveGameWinRatePct),
    fifthGameRalliesWon: c.fifthGameRalliesWon,
    fifthGameRalliesLost: c.fifthGameRalliesLost,
    fifthGameRallyWinRatePct: num3(c.fifthGameRallyWinRatePct),

    closeGamesPlayed: c.closeGamesPlayed,
    closeGamesWon: c.closeGamesWon,
    closeGamesLost: c.closeGamesLost,
    closeGameRatePct: num3(c.closeGameRatePct),
    closeGameWinRatePct: num3(c.closeGameWinRatePct),
    overtimeGamesPlayed: c.overtimeGamesPlayed,
    overtimeGamesWon: c.overtimeGamesWon,
    overtimeGamesLost: c.overtimeGamesLost,
    overtimeGameRatePct: num3(c.overtimeGameRatePct),
    overtimeGameWinRatePct: num3(c.overtimeGameWinRatePct),

    dominantGamesWon: c.dominantGamesWon,
    heavyGamesLost: c.heavyGamesLost,
    dominantGameWinRatePct: num3(c.dominantGameWinRatePct),
    heavyGameLossRatePct: num3(c.heavyGameLossRatePct),

    totalMatchDurationSec: c.totalMatchDurationSec,
    avgMatchDurationSec: num3(c.avgMatchDurationSec),
    shortestMatchDurationSec: c.shortestMatchDurationSec,
    longestMatchDurationSec: c.longestMatchDurationSec,
    avgGameDurationSec: num3(c.avgGameDurationSec),
    avgSecondsPerRally: num3(c.avgSecondsPerRally),
    matchLoadScore: num3(c.matchLoadScore),

    formIndex: num3(c.formIndex),
    skillIndex: num3(c.skillIndex),
    skillIndexStatus: c.skillIndexStatus,
    skillRating: num3(rating.skillRating),
    skillRatingReliability: num3(rating.reliability),
    skillRatingK: isCareer ? calibration.adaptiveK : null,
    skillRatingCalibrationVersion: isCareer ? calibration.version : null,
    skillRatingReliabilityStatus: isCareer ? getSkillRatingReliabilityStatus(c.matchesPlayed) : null,
    skillRatingLevelStatus: ratingLevel,
    skillRatingCalculatedAt: isCareer ? new Date() : null,
    matchConversionPp: num3(c.matchConversionPp),
    gameConversionPp: num3(c.gameConversionPp),
    resultConversionPp: num3(c.resultConversionPp),

    matchesTrailed0_2: c.matchesTrailed0_2,
    reverseSweepWins: c.reverseSweepWins,
    reverseSweepWinRatePct: num3(c.reverseSweepWinRatePct),
    forcedFifthAfterTrailing0_2: c.forcedFifthAfterTrailing0_2,
    forcedFifthRateAfterTrailing0_2Pct: num3(c.forcedFifthRateAfterTrailing0_2Pct),
    matchesLostAfterTrailing0_2: c.matchesLostAfterTrailing0_2,
    gamesWonAfterTrailing0_2: c.gamesWonAfterTrailing0_2,
    avgGamesWonAfterTrailing0_2: num3(c.avgGamesWonAfterTrailing0_2),
    matchesLed2_0: c.matchesLed2_0,
    winsAfterLeading2_0: c.winsAfterLeading2_0,
    lossesAfterLeading2_0: c.lossesAfterLeading2_0,
    blownTwoGameLeadRatePct: num3(c.blownTwoGameLeadRatePct),
    reverseSweepLosses: c.reverseSweepLosses,

    avgGamesWonPerMatch: num3(c.avgGamesWonPerMatch),
    avgGamesLostPerMatch: num3(c.avgGamesLostPerMatch),
    avgGamesPlayedPerMatch: num3(c.avgGamesPlayedPerMatch),
    avgRalliesWonPerMatch: num3(c.avgRalliesWonPerMatch),
    avgRalliesLostPerMatch: num3(c.avgRalliesLostPerMatch),
    avgRalliesPlayedPerMatch: num3(c.avgRalliesPlayedPerMatch),
    avgMatchGamesWon: num3(c.avgMatchGamesWon),
    avgMatchGamesLost: num3(c.avgMatchGamesLost),
    avgRallyMarginPerGame: num3(c.avgRallyMarginPerGame),

    currentWinStreak: c.currentWinStreak,
    currentLossStreak: c.currentLossStreak,
    longestWinStreak: c.longestWinStreak,
    longestLossStreak: c.longestLossStreak,
    last5MatchesPlayed: c.last5MatchesPlayed,
    last5MatchesWon: c.last5MatchesWon,
    last5MatchesLost: c.last5MatchesLost,
    last5MatchWinRatePct: num3(c.last5MatchWinRatePct),
    last5GameWinRatePct: num3(c.last5GameWinRatePct),
    last5RallyWinRatePct: num3(c.last5RallyWinRatePct),
    last10MatchesPlayed: c.last10MatchesPlayed,
    last10MatchesWon: c.last10MatchesWon,
    last10MatchesLost: c.last10MatchesLost,
    last10MatchWinRatePct: num3(c.last10MatchWinRatePct),
    last10GameWinRatePct: num3(c.last10GameWinRatePct),
    last10RallyWinRatePct: num3(c.last10RallyWinRatePct),

    matchWinRateTrendPp: num3(c.matchWinRateTrendPp),
    gameWinRateTrendPp: num3(c.gameWinRateTrendPp),
    rallyWinRateTrendPp: num3(c.rallyWinRateTrendPp),
    formIndexTrend: num3(c.formIndexTrend),
    cumulativeGameBalance: c.cumulativeGameBalance,
    cumulativeRallyBalance: c.cumulativeRallyBalance,

    statsReliabilityScore: num3(c.statsReliabilityScore),

    sampleSizeLevel: sampleSizeLevel(c.matchesPlayed),

    calculatedAt: new Date(),
  };
}

/** Map a head-to-head match set (player vs one opponent) into an H2H row. */
function opponentRow(
  playerId: number,
  opponentId: number,
  perspectives: MatchPerspective[],
  perspectivesDesc: MatchPerspective[],
  scope: "career" | "season" | "season_division",
  seasonId: number | null,
  division: number | null,
): NewPlayerOpponentStats {
  const c = computeAggregate(perspectives);
  const rf = recentForm(perspectivesDesc, 5);
  const cls = classifyMatchup({
    meetings: c.matchesPlayed,
    comfortIndex: c.formIndex,
    matchesWon: c.matchesWon,
    matchesLost: c.matchesLost,
    rallyWinRatePct: c.rallyWinRatePct,
    fiveGameWinRatePct: c.fiveGameWinRatePct,
    closeGameWinRatePct: c.closeGameWinRatePct,
    fiveGameMatchRatePct: c.fiveGameMatchRatePct,
    avgMatchDurationSec: c.avgMatchDurationSec,
    recentResults: rf.results,
  });
  return {
    playerId,
    opponentId,
    scope,
    seasonId,
    division,
    meetingsPlayed: c.matchesPlayed,
    firstMeetingAt: c.firstMatchAt,
    lastMeetingAt: c.lastMatchAt,
    h2hMatchesWon: c.matchesWon,
    h2hMatchesLost: c.matchesLost,
    h2hMatchWinRatePct: num3(c.matchWinRatePct),
    h2hGamesPlayed: c.gamesPlayed,
    h2hGamesWon: c.gamesWon,
    h2hGamesLost: c.gamesLost,
    h2hGameWinRatePct: num3(c.gameWinRatePct),
    h2hGameBalance: c.gameBalance,
    h2hGameBalancePerMatch: num3(c.gameBalancePerMatch),
    h2hRalliesPlayed: c.ralliesPlayed,
    h2hRalliesWon: c.ralliesWon,
    h2hRalliesLost: c.ralliesLost,
    h2hRallyWinRatePct: num3(c.rallyWinRatePct),
    h2hRallyBalance: c.rallyBalance,
    h2hRallyBalancePerMatch: num3(c.rallyBalancePerMatch),
    h2hWins3_0: c.wins3_0,
    h2hWins3_1: c.wins3_1,
    h2hWins3_2: c.wins3_2,
    h2hLosses2_3: c.losses2_3,
    h2hLosses1_3: c.losses1_3,
    h2hLosses0_3: c.losses0_3,
    h2hCleanWins: c.cleanWins,
    h2hCleanLosses: c.cleanLosses,
    h2hFiveGameMatches: c.fiveGameMatches,
    h2hFiveGameMatchesWon: c.fiveGameMatchesWon,
    h2hFiveGameMatchesLost: c.fiveGameMatchesLost,
    h2hFiveGameWinRatePct: num3(c.fiveGameWinRatePct),
    h2hCloseGamesWon: c.closeGamesWon,
    h2hCloseGamesLost: c.closeGamesLost,
    h2hCloseGameWinRatePct: num3(c.closeGameWinRatePct),
    h2hOvertimeGamesWon: c.overtimeGamesWon,
    h2hOvertimeGamesLost: c.overtimeGamesLost,
    h2hDominantGamesWon: c.dominantGamesWon,
    h2hHeavyGamesLost: c.heavyGamesLost,
    h2hTotalMatchDurationSec: c.totalMatchDurationSec,
    h2hAvgMatchDurationSec: num3(c.avgMatchDurationSec),
    h2hMatchesTrailed0_2: c.matchesTrailed0_2,
    h2hReverseSweepWins: c.reverseSweepWins,
    h2hReverseSweepWinRatePct: num3(c.reverseSweepWinRatePct),
    h2hForcedFifthAfterTrailing0_2: c.forcedFifthAfterTrailing0_2,
    h2hForcedFifthRateAfterTrailing0_2Pct: num3(c.forcedFifthRateAfterTrailing0_2Pct),
    h2hMatchesLostAfterTrailing0_2: c.matchesLostAfterTrailing0_2,
    h2hGamesWonAfterTrailing0_2: c.gamesWonAfterTrailing0_2,
    h2hAvgGamesWonAfterTrailing0_2: num3(c.avgGamesWonAfterTrailing0_2),
    h2hMatchesLed2_0: c.matchesLed2_0,
    h2hWinsAfterLeading2_0: c.winsAfterLeading2_0,
    h2hLossesAfterLeading2_0: c.lossesAfterLeading2_0,
    h2hBlownTwoGameLeadRatePct: num3(c.blownTwoGameLeadRatePct),
    h2hReverseSweepLosses: c.reverseSweepLosses,
    h2hLast5MatchesWon: rf.won,
    h2hLast5MatchesLost: rf.lost,
    h2hRecentResults: rf.results,
    h2hRecentMatchScores: rf.scores,
    matchupComfortIndex: num3(c.formIndex),
    matchupStatus: cls.status,
    hasClosingProblemVsOpponent: cls.hasClosingProblem,
    hasPositiveTrendVsOpponent: cls.hasPositiveTrend,
    isHighLoadOpponent: cls.isHighLoad,
    h2hAvgGamesWonPerMatch: num3(c.avgGamesWonPerMatch),
    h2hAvgGamesLostPerMatch: num3(c.avgGamesLostPerMatch),
    h2hAvgGamesPlayedPerMatch: num3(c.avgGamesPlayedPerMatch),
    h2hAvgRalliesWonPerMatch: num3(c.avgRalliesWonPerMatch),
    h2hAvgRalliesLostPerMatch: num3(c.avgRalliesLostPerMatch),
    h2hAvgRalliesPlayedPerMatch: num3(c.avgRalliesPlayedPerMatch),
    h2hAvgRallyMarginPerGame: num3(c.avgRallyMarginPerGame),
    h2hMatchWinRateTrendPp: num3(c.matchWinRateTrendPp),
    h2hGameWinRateTrendPp: num3(c.gameWinRateTrendPp),
    h2hRallyWinRateTrendPp: num3(c.rallyWinRateTrendPp),
    statsReliabilityScore: num3(c.statsReliabilityScore),
    sampleSizeLevel: sampleSizeLevel(c.matchesPlayed),
    calculatedAt: new Date(),
  };
}

/** Cumulative-through-stage chart series for one player within one season. */
function buildSeriesPoints(
  playerId: number,
  seasonId: number,
  seasonRows: JoinedMatch[],
): NewPlayerMetricSeriesPoint[] {
  const byStage = new Map<number, JoinedMatch[]>();
  const stageIdByNo = new Map<number, number>();
  for (const r of seasonRows) {
    (byStage.get(r.stageNumber) ?? byStage.set(r.stageNumber, []).get(r.stageNumber)!).push(r);
    stageIdByNo.set(r.stageNumber, r.stageId);
  }
  const stageNos = [...byStage.keys()].sort((x, y) => x - y);

  const points: NewPlayerMetricSeriesPoint[] = [];
  let running: MatchPerspective[] = [];
  for (const no of stageNos) {
    running = running.concat(byStage.get(no)!.map((r) => toPerspective(r, playerId)));
    const c = computeAggregate(running);
    const stageId = stageIdByNo.get(no)!;
    const metrics: { key: NewPlayerMetricSeriesPoint["metricKey"]; value: number | null }[] = [
      { key: "matchWinRatePct", value: c.matchWinRatePct },
      { key: "gameWinRatePct", value: c.gameWinRatePct },
      { key: "rallyWinRatePct", value: c.rallyWinRatePct },
      { key: "formIndex", value: c.formIndex },
      { key: "skillIndex", value: c.skillIndex },
      { key: "gameBalancePerMatch", value: c.gameBalancePerMatch },
      { key: "rallyBalancePerMatch", value: c.rallyBalancePerMatch },
      { key: "cumulativeGameBalance", value: c.cumulativeGameBalance },
      { key: "cumulativeRallyBalance", value: c.cumulativeRallyBalance },
      { key: "matchesPlayed", value: c.matchesPlayed },
    ];
    for (const m of metrics) {
      if (m.value === null) continue;
      points.push({
        playerId,
        metricKey: m.key,
        seasonId,
        stageId,
        orderIndex: no,
        label: `Э${no}`,
        value: m.value.toFixed(3),
      });
    }
  }
  return points;
}

/**
 * Recompute career / season / stage aggregates for one player from raw
 * matches. Replaces the player's existing aggregate rows in one transaction.
 */
export async function recalcPlayer(
  playerId: number,
  database: Database = defaultDb,
): Promise<void> {
  const rows = (await loadPlayerMatches(database, playerId)) as JoinedMatch[];
  const calibration = await loadActiveSkillRatingCalibration(database);
  // chronological order drives streaks / last-N / trend metrics
  rows.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const bySeason = new Map<number, JoinedMatch[]>();
  const byStage = new Map<number, JoinedMatch[]>();
  const bySeasonDivision = new Map<string, JoinedMatch[]>();
  const byStageDivision = new Map<string, JoinedMatch[]>();
  const push = <K>(map: Map<K, JoinedMatch[]>, key: K, row: JoinedMatch) => {
    (map.get(key) ?? map.set(key, []).get(key)!).push(row);
  };
  for (const row of rows) {
    push(bySeason, row.seasonId, row);
    push(byStage, row.stageId, row);
    push(bySeasonDivision, `${row.seasonId}:${row.division}`, row);
    push(byStageDivision, `${row.stageId}:${row.division}`, row);
  }

  const out: NewPlayerStatsAggregate[] = [];

  // career
  {
    const persp = rows.map((r) => toPerspective(r, playerId));
    out.push(
      aggregateRow(playerId, "career", null, null, null, computeAggregate(persp), bySeason.size, byStage.size, divisionCount(rows), calibration),
    );
  }

  // per season (all divisions merged)
  for (const [seasonId, seasonRows] of bySeason) {
    const persp = seasonRows.map((r) => toPerspective(r, playerId));
    const stagesPlayed = new Set(seasonRows.map((r) => r.stageId)).size;
    out.push(
      aggregateRow(playerId, "season", seasonId, null, null, computeAggregate(persp), 1, stagesPlayed, divisionCount(seasonRows), calibration),
    );
  }

  // per season + division
  for (const seasonRows of bySeasonDivision.values()) {
    const persp = seasonRows.map((r) => toPerspective(r, playerId));
    const seasonId = seasonRows[0]!.seasonId;
    const division = seasonRows[0]!.division;
    const stagesPlayed = new Set(seasonRows.map((r) => r.stageId)).size;
    out.push(
      aggregateRow(playerId, "season_division", seasonId, null, division, computeAggregate(persp), 1, stagesPlayed, 1, calibration),
    );
  }

  // per stage (all divisions merged)
  for (const [stageId, stageRows] of byStage) {
    const persp = stageRows.map((r) => toPerspective(r, playerId));
    const seasonId = stageRows[0]?.seasonId ?? null;
    out.push(
      aggregateRow(playerId, "stage", seasonId, stageId, null, computeAggregate(persp), 1, 1, divisionCount(stageRows), calibration),
    );
  }

  // per stage + division
  for (const stageRows of byStageDivision.values()) {
    const persp = stageRows.map((r) => toPerspective(r, playerId));
    const seasonId = stageRows[0]!.seasonId;
    const stageId = stageRows[0]!.stageId;
    const division = stageRows[0]!.division;
    out.push(
      aggregateRow(playerId, "stage_division", seasonId, stageId, division, computeAggregate(persp), 1, 1, 1, calibration),
    );
  }

  // head-to-head: career + per-season + per-season-division, one row per (scope, opponent)
  const oppOut: NewPlayerOpponentStats[] = [];
  const emitOpponents = (
    scope: "career" | "season" | "season_division",
    seasonId: number | null,
    division: number | null,
    scopeRows: JoinedMatch[],
  ) => {
    const byOpponent = new Map<number, JoinedMatch[]>();
    for (const row of scopeRows) {
      const opponentId = row.playerAId === playerId ? row.playerBId : row.playerAId;
      push(byOpponent, opponentId, row);
    }
    for (const [opponentId, oppRows] of byOpponent) {
      const persp = oppRows.map((r) => toPerspective(r, playerId));
      const desc = [...oppRows]
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
        .map((r) => toPerspective(r, playerId));
      oppOut.push(opponentRow(playerId, opponentId, persp, desc, scope, seasonId, division));
    }
  };
  emitOpponents("career", null, null, rows);
  for (const [seasonId, seasonRows] of bySeason) emitOpponents("season", seasonId, null, seasonRows);
  for (const seasonRows of bySeasonDivision.values()) {
    emitOpponents("season_division", seasonRows[0]!.seasonId, seasonRows[0]!.division, seasonRows);
  }

  // chart series cache, per season
  const seriesOut: NewPlayerMetricSeriesPoint[] = [];
  for (const [seasonId, seasonRows] of bySeason) {
    seriesOut.push(...buildSeriesPoints(playerId, seasonId, seasonRows));
  }

  await database.transaction(async (tx) => {
    await tx.delete(playerStatsAggregate).where(eq(playerStatsAggregate.playerId, playerId));
    if (out.length) await tx.insert(playerStatsAggregate).values(out);
    await tx.delete(playerOpponentStats).where(eq(playerOpponentStats.playerId, playerId));
    if (oppOut.length) await tx.insert(playerOpponentStats).values(oppOut);
    await tx.delete(playerMetricSeriesPoint).where(eq(playerMetricSeriesPoint.playerId, playerId));
    if (seriesOut.length) await tx.insert(playerMetricSeriesPoint).values(seriesOut);
  });
}


/**
 * Recompute everything touched by one parsed stage-division: regenerate
 * match_games for its matches and recalc every involved player's aggregates.
 * This is the hook the parse worker calls after an import completes.
 */
export async function recalcStageDivision(
  stageId: number,
  division: number,
  database: Database = defaultDb,
): Promise<{ matches: number; players: number }> {
  const ms = await database
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      scoreDetail: matches.scoreDetail,
    })
    .from(matches)
    .where(and(eq(matches.stageId, stageId), eq(matches.division, division)));

  const ids = ms.map((m) => m.id);
  await database.transaction(async (tx) => {
    if (ids.length) {
      await tx.delete(matchGames).where(inArray(matchGames.matchId, ids));
      const rows = ms.flatMap((m) => buildMatchGameRows(m));
      if (rows.length) await tx.insert(matchGames).values(rows);
    }
  });

  const playerIds = new Set<number>();
  for (const m of ms) {
    playerIds.add(m.playerAId);
    playerIds.add(m.playerBId);
  }
  for (const playerId of playerIds) {
    await recalcPlayer(playerId, database);
  }

  return { matches: ms.length, players: playerIds.size };
}

/** Build canonical match_games rows from a match's per-game score detail. */
export function buildMatchGameRows(match: {
  id: number;
  playerAId: number;
  playerBId: number;
  scoreDetail: GamePair[] | null;
}): NewMatchGame[] {
  if (!match.scoreDetail?.length) return [];
  return match.scoreDetail.map((g, i) => {
    const f = gameFlags(g.a, g.b);
    return {
      matchId: match.id,
      gameNumber: i + 1,
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      playerAScore: g.a,
      playerBScore: g.b,
      winnerId: f.winnerIsA ? match.playerAId : match.playerBId,
      loserId: f.winnerIsA ? match.playerBId : match.playerAId,
      pointMargin: f.pointMargin,
      isCloseGame: f.isCloseGame,
      isOvertimeGame: f.isOvertimeGame,
      isDominantGame: f.isDominantGame,
    } satisfies NewMatchGame;
  });
}


/** Backfill match_games for every match, then recompute every player's stats. */
export async function backfillAll(database: Database = defaultDb): Promise<{
  matchesProcessed: number;
  gamesInserted: number;
  playersRecalculated: number;
}> {
  const allMatches = await database
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      scoreDetail: matches.scoreDetail,
    })
    .from(matches);

  let gamesInserted = 0;
  await database.transaction(async (tx) => {
    await tx.delete(matchGames);
    for (const m of allMatches) {
      const rows = buildMatchGameRows(m);
      if (rows.length) {
        await tx.insert(matchGames).values(rows);
        gamesInserted += rows.length;
      }
    }
  });

  const playerIds = new Set<number>();
  for (const m of allMatches) {
    playerIds.add(m.playerAId);
    playerIds.add(m.playerBId);
  }
  await recalibrateCareerSkillRating(database);
  for (const playerId of playerIds) {
    await recalcPlayer(playerId, database);
  }

  return {
    matchesProcessed: allMatches.length,
    gamesInserted,
    playersRecalculated: playerIds.size,
  };
}
