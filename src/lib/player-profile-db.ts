/**
 * DB-backed assembly of the player profile model. Reads precomputed aggregates
 * (player_stats_aggregate / player_opponent_stats) instead of recomputing
 * metrics on the fly — the source of truth is recalc.ts. Source data that is
 * NOT a metric (player snapshot, raw match list, season/division filters) still
 * comes from the loaded leagues.
 */

import { eq } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import {
  players,
  playerOpponentStats,
  playerStatsAggregate,
  seasons,
  stages,
  type PlayerOpponentStatsRow,
  type PlayerStatsAggregateRow,
} from "@/lib/db/schema";
import { CURRENT_SEASON, type League } from "@/lib/mock/league";
import {
  buildDivisionsBySeason,
  buildPlayerProfileModel,
  buildRoster,
  collectPlayerData,
  contextKey,
  currentDivisionPlaces,
  emptyStats,
  filterMatches,
  makeContext,
  normalizePlayerProfileContext,
  pickPlayerSnapshot,
  placeDistribution,
  seasonStart,
  type MatchListItem,
  type MatchupStatus,
  type PlayerOpponentStats,
  type PlayerProfileContextData,
  type PlayerProfileModel,
  type PlayerProfilePlacePoint,
  type PlayerProfileSeriesPoint,
  type PlayerProfileStats,
  type SampleSizeLevel,
} from "@/lib/player-profile";

type QueryInput = { seasonId?: string | null; divisionId?: string | number | null };

const num = (v: string | null): number | null => (v === null ? null : Number(v));

/** Map a denormalized aggregate row into the page's PlayerProfileStats shape. */
function mapAggregate(r: PlayerStatsAggregateRow): PlayerProfileStats {
  return {
    seasonsPlayed: r.seasonsPlayed,
    stagesPlayed: r.stagesPlayed,
    divisionsPlayed: r.divisionsPlayed,
    matchesPlayed: r.matchesPlayed,
    matchesWon: r.matchesWon,
    matchesLost: r.matchesLost,
    gamesPlayed: r.gamesPlayed,
    gamesWon: r.gamesWon,
    gamesLost: r.gamesLost,
    ralliesPlayed: r.ralliesPlayed,
    ralliesWon: r.ralliesWon,
    ralliesLost: r.ralliesLost,
    matchWinRatePct: num(r.matchWinRatePct),
    gameWinRatePct: num(r.gameWinRatePct),
    rallyWinRatePct: num(r.rallyWinRatePct),
    gameBalance: r.gameBalance,
    rallyBalance: r.rallyBalance,
    gameBalancePerMatch: num(r.gameBalancePerMatch),
    rallyBalancePerMatch: num(r.rallyBalancePerMatch),
    wins3_0: r.wins3_0,
    wins3_1: r.wins3_1,
    wins3_2: r.wins3_2,
    losses2_3: r.losses2_3,
    losses1_3: r.losses1_3,
    losses0_3: r.losses0_3,
    cleanWins: r.cleanWins,
    cleanLosses: r.cleanLosses,
    cleanWinRatePct: num(r.cleanWinRatePct),
    cleanLossRatePct: num(r.cleanLossRatePct),
    fiveGameMatches: r.fiveGameMatches,
    fiveGameMatchesWon: r.fiveGameMatchesWon,
    fiveGameMatchesLost: r.fiveGameMatchesLost,
    fiveGameMatchRatePct: num(r.fiveGameMatchRatePct),
    fiveGameWinRatePct: num(r.fiveGameWinRatePct),
    fifthGameRalliesWon: r.fifthGameRalliesWon,
    fifthGameRalliesLost: r.fifthGameRalliesLost,
    fifthGameRallyWinRatePct: num(r.fifthGameRallyWinRatePct),
    closeGamesPlayed: r.closeGamesPlayed,
    closeGamesWon: r.closeGamesWon,
    closeGamesLost: r.closeGamesLost,
    closeGameRatePct: num(r.closeGameRatePct),
    closeGameWinRatePct: num(r.closeGameWinRatePct),
    overtimeGamesPlayed: r.overtimeGamesPlayed,
    overtimeGamesWon: r.overtimeGamesWon,
    overtimeGamesLost: r.overtimeGamesLost,
    overtimeGameRatePct: num(r.overtimeGameRatePct),
    overtimeGameWinRatePct: num(r.overtimeGameWinRatePct),
    dominantGamesWon: r.dominantGamesWon,
    heavyGamesLost: r.heavyGamesLost,
    dominantGameWinRatePct: num(r.dominantGameWinRatePct),
    heavyGameLossRatePct: num(r.heavyGameLossRatePct),
    totalMatchDurationSec: r.totalMatchDurationSec,
    avgMatchDurationSec: num(r.avgMatchDurationSec),
    shortestMatchDurationSec: r.shortestMatchDurationSec,
    longestMatchDurationSec: r.longestMatchDurationSec,
    avgGameDurationSec: num(r.avgGameDurationSec),
    avgSecondsPerRally: num(r.avgSecondsPerRally),
    matchLoadScore: num(r.matchLoadScore),
    formIndex: num(r.formIndex),
    skillIndex: num(r.skillIndex),
    skillIndexStatus: r.skillIndexStatus,
    matchConversionPp: num(r.matchConversionPp),
    gameConversionPp: num(r.gameConversionPp),
    resultConversionPp: num(r.resultConversionPp),
    matchesTrailed0_2: r.matchesTrailed0_2,
    reverseSweepWins: r.reverseSweepWins,
    reverseSweepWinRatePct: num(r.reverseSweepWinRatePct),
    forcedFifthAfterTrailing0_2: r.forcedFifthAfterTrailing0_2,
    forcedFifthRateAfterTrailing0_2Pct: num(r.forcedFifthRateAfterTrailing0_2Pct),
    matchesLostAfterTrailing0_2: r.matchesLostAfterTrailing0_2,
    gamesWonAfterTrailing0_2: r.gamesWonAfterTrailing0_2,
    avgGamesWonAfterTrailing0_2: num(r.avgGamesWonAfterTrailing0_2),
    matchesLed2_0: r.matchesLed2_0,
    winsAfterLeading2_0: r.winsAfterLeading2_0,
    lossesAfterLeading2_0: r.lossesAfterLeading2_0,
    blownTwoGameLeadRatePct: num(r.blownTwoGameLeadRatePct),
    reverseSweepLosses: r.reverseSweepLosses,
    avgGamesWonPerMatch: num(r.avgGamesWonPerMatch),
    avgGamesLostPerMatch: num(r.avgGamesLostPerMatch),
    avgGamesPlayedPerMatch: num(r.avgGamesPlayedPerMatch),
    avgRalliesWonPerMatch: num(r.avgRalliesWonPerMatch),
    avgRalliesLostPerMatch: num(r.avgRalliesLostPerMatch),
    avgRalliesPlayedPerMatch: num(r.avgRalliesPlayedPerMatch),
    avgMatchGamesWon: num(r.avgMatchGamesWon),
    avgMatchGamesLost: num(r.avgMatchGamesLost),
    avgRallyMarginPerGame: num(r.avgRallyMarginPerGame),
    currentWinStreak: r.currentWinStreak,
    currentLossStreak: r.currentLossStreak,
    longestWinStreak: r.longestWinStreak,
    longestLossStreak: r.longestLossStreak,
    last5MatchesPlayed: r.last5MatchesPlayed,
    last5MatchesWon: r.last5MatchesWon,
    last5MatchesLost: r.last5MatchesLost,
    last5MatchWinRatePct: num(r.last5MatchWinRatePct),
    last10MatchesPlayed: r.last10MatchesPlayed,
    last10MatchesWon: r.last10MatchesWon,
    last10MatchesLost: r.last10MatchesLost,
    last10MatchWinRatePct: num(r.last10MatchWinRatePct),
    cumulativeGameBalance: r.cumulativeGameBalance,
    cumulativeRallyBalance: r.cumulativeRallyBalance,
    statsReliabilityScore: num(r.statsReliabilityScore),
    sampleSizeLevel: (r.sampleSizeLevel ?? "very_low") as SampleSizeLevel,
  };
}

type OppDisplay = { rid: string; name: string; initials: string; color: string };

function mapOpponent(r: PlayerOpponentStatsRow, display: OppDisplay | undefined): PlayerOpponentStats {
  return {
    opponentRid: display?.rid ?? String(r.opponentId),
    opponentName: display?.name ?? " - ",
    opponentInitials: display?.initials ?? " - ",
    opponentColor: display?.color ?? "var(--m3-surface-container-high)",
    meetingsPlayed: r.meetingsPlayed,
    h2hMatchesWon: r.h2hMatchesWon,
    h2hMatchesLost: r.h2hMatchesLost,
    h2hMatchWinRatePct: num(r.h2hMatchWinRatePct),
    h2hGamesWon: r.h2hGamesWon,
    h2hGamesLost: r.h2hGamesLost,
    h2hGameWinRatePct: num(r.h2hGameWinRatePct),
    h2hRalliesWon: r.h2hRalliesWon,
    h2hRalliesLost: r.h2hRalliesLost,
    h2hRallyWinRatePct: num(r.h2hRallyWinRatePct),
    h2hFiveGameMatchesWon: r.h2hFiveGameMatchesWon,
    h2hFiveGameMatchesLost: r.h2hFiveGameMatchesLost,
    h2hFiveGameWinRatePct: num(r.h2hFiveGameWinRatePct),
    h2hAvgMatchDurationSec: num(r.h2hAvgMatchDurationSec),
    matchupComfortIndex: num(r.matchupComfortIndex),
    matchupStatus: (r.matchupStatus ?? "not_enough_data") as MatchupStatus,
    hasClosingProblem: r.hasClosingProblemVsOpponent,
    hasPositiveTrend: r.hasPositiveTrendVsOpponent,
    isHighLoad: r.isHighLoadOpponent,
  };
}

const STAGE_COUNT = 9;

export async function buildPlayerProfileModelFromDb(
  leagues: Record<string, League>,
  rid: string,
  query: QueryInput = {},
  database: Database = defaultDb,
): Promise<PlayerProfileModel | null> {
  const data = collectPlayerData(leagues, rid);
  const player = pickPlayerSnapshot(data);
  if (!player) return null;

  const [idRow] = await database.select({ id: players.id }).from(players).where(eq(players.rankedinId, rid)).limit(1);
  // No DB id (e.g. player without rankedinId) — fall back to the pure TS model.
  if (!idRow) return buildPlayerProfileModel(leagues, rid, query);
  const playerId = idRow.id;

  const seasonsList = [...new Set([...data.results.map((r) => r.seasonId), ...data.matches.map((m) => m.seasonId)])]
    .sort((a, b) => seasonStart(b) - seasonStart(a));
  const divisionsBySeason = buildDivisionsBySeason(data.results);

  // season id (int) <-> label
  const seasonRows = await database.select({ id: seasons.id, label: seasons.label }).from(seasons);
  const labelById = new Map(seasonRows.map((s) => [s.id, s.label]));

  // stage id -> number
  const stageRows = await database.select({ id: stages.id, number: stages.number }).from(stages);
  const stageNumberById = new Map(stageRows.map((s) => [s.id, s.number]));

  // opponent display (rid/name/initials/color) from the loaded leagues, keyed by DB opponent id
  const oppByRid = new Map<string, OppDisplay>();
  for (const league of Object.values(leagues)) {
    for (const p of league.players) {
      if (!oppByRid.has(p.rid)) oppByRid.set(p.rid, { rid: p.rid, name: p.name, initials: p.initials, color: p.color });
    }
  }
  const oppPlayerRows = await database.select({ id: players.id, rid: players.rankedinId }).from(players);
  const oppDisplayById = new Map<number, OppDisplay>();
  for (const p of oppPlayerRows) {
    if (p.rid) oppDisplayById.set(p.id, oppByRid.get(p.rid) ?? { rid: p.rid, name: p.rid, initials: " - ", color: "var(--m3-surface-container-high)" });
  }

  // all aggregate rows for the player
  const aggRows = await database.select().from(playerStatsAggregate).where(eq(playerStatsAggregate.playerId, playerId));
  const careerRow = aggRows.find((r) => r.scope === "career");
  const seasonByLabel = new Map<string, PlayerStatsAggregateRow>();
  const seasonDivByKey = new Map<string, PlayerStatsAggregateRow>();
  const stageBySeason = new Map<string, { stage: number; stats: PlayerProfileStats }[]>();
  const stageDivByKey = new Map<string, { stage: number; stats: PlayerProfileStats }[]>();
  for (const r of aggRows) {
    const label = r.seasonId != null ? labelById.get(r.seasonId) : undefined;
    if (r.scope === "season" && label) seasonByLabel.set(label, r);
    else if (r.scope === "season_division" && label && r.division != null) seasonDivByKey.set(`${label}::${r.division}`, r);
    else if (r.scope === "stage" && label && r.stageId != null) {
      const stage = stageNumberById.get(r.stageId) ?? 0;
      (stageBySeason.get(label) ?? stageBySeason.set(label, []).get(label)!).push({ stage, stats: mapAggregate(r) });
    } else if (r.scope === "stage_division" && label && r.stageId != null && r.division != null) {
      const stage = stageNumberById.get(r.stageId) ?? 0;
      const key = `${label}::${r.division}`;
      (stageDivByKey.get(key) ?? stageDivByKey.set(key, []).get(key)!).push({ stage, stats: mapAggregate(r) });
    }
  }

  // opponent rows by scope
  const oppRows = await database.select().from(playerOpponentStats).where(eq(playerOpponentStats.playerId, playerId));
  const oppCareer: PlayerOpponentStats[] = [];
  const oppSeasonByLabel = new Map<string, PlayerOpponentStats[]>();
  const oppSeasonDivByKey = new Map<string, PlayerOpponentStats[]>();
  for (const r of oppRows) {
    const mapped = mapOpponent(r, oppDisplayById.get(r.opponentId));
    const label = r.seasonId != null ? labelById.get(r.seasonId) : undefined;
    if (r.scope === "career") oppCareer.push(mapped);
    else if (r.scope === "season" && label) (oppSeasonByLabel.get(label) ?? oppSeasonByLabel.set(label, []).get(label)!).push(mapped);
    else if (r.scope === "season_division" && label && r.division != null) {
      const key = `${label}::${r.division}`;
      (oppSeasonDivByKey.get(key) ?? oppSeasonDivByKey.set(key, []).get(key)!).push(mapped);
    }
  }
  const byMeetingsDesc = (list: PlayerOpponentStats[]) => [...list].sort((a, b) => b.meetingsPlayed - a.meetingsPlayed);
  const h2hCareer = byMeetingsDesc(oppCareer);

  const careerStats = careerRow ? mapAggregate(careerRow) : emptyStats();

  function stageSeries(label: string, division: number | null): PlayerProfileSeriesPoint[] {
    const source = division == null ? stageBySeason.get(label) ?? [] : stageDivByKey.get(`${label}::${division}`) ?? [];
    const byStage = new Map(source.map((s) => [s.stage, s.stats]));
    const league = leagues[label];
    return Array.from({ length: STAGE_COUNT }, (_, i) => {
      const stage = i + 1;
      const stats = byStage.get(stage) ?? emptyStats();
      return { ...stats, orderIndex: stage, label: `Этап ${stage}`, seasonId: label, stage, date: league?.stages.find((s) => s.no === stage)?.date };
    });
  }

  function seasonSeries(): PlayerProfileSeriesPoint[] {
    return [...seasonsList]
      .sort((a, b) => seasonStart(a) - seasonStart(b))
      .map((label, index) => {
        const row = seasonByLabel.get(label);
        return { ...(row ? mapAggregate(row) : emptyStats()), orderIndex: index + 1, label, seasonId: label };
      });
  }

  function placeSeries(seasonId: string | null, division: number | null): PlayerProfilePlacePoint[] {
    return data.results
      .filter((r) => (!seasonId || r.seasonId === seasonId) && (!division || r.div === division) && r.place > 0)
      .sort((a, b) => seasonStart(a.seasonId) - seasonStart(b.seasonId) || a.stage - b.stage || a.div - b.div)
      .map((r, index) => {
        const league = leagues[r.seasonId];
        return {
          orderIndex: index + 1,
          label: seasonId ? (division ? `Э${r.stage}` : `Э${r.stage} · Д${r.div}`) : `${r.seasonId} · Э${r.stage} · Д${r.div}`,
          seasonId: r.seasonId,
          stage: r.stage,
          divisionId: r.div,
          place: r.place,
          date: league?.stages.find((s) => s.no === r.stage)?.date ?? r.date,
        };
      });
  }

  function buildContext(seasonId: string | null, division: number | null): PlayerProfileContextData {
    const normalizedDivision = seasonId ? division : null;
    const context = makeContext(seasonId, normalizedDivision);
    const scoped: PlayerProfileStats = !seasonId
      ? careerStats
      : normalizedDivision == null
        ? seasonByLabel.has(seasonId)
          ? mapAggregate(seasonByLabel.get(seasonId)!)
          : emptyStats()
        : seasonDivByKey.has(`${seasonId}::${normalizedDivision}`)
          ? mapAggregate(seasonDivByKey.get(`${seasonId}::${normalizedDivision}`)!)
          : emptyStats();
    const scopedH2h = !seasonId
      ? h2hCareer
      : normalizedDivision == null
        ? byMeetingsDesc(oppSeasonByLabel.get(seasonId) ?? [])
        : byMeetingsDesc(oppSeasonDivByKey.get(`${seasonId}::${normalizedDivision}`) ?? []);
    const matches: MatchListItem[] = filterMatches(data.matches, seasonId, normalizedDivision).sort((a, b) => b.order - a.order);
    return {
      key: contextKey(seasonId, normalizedDivision),
      context,
      scopedStats: scoped,
      chartSeries: seasonId
        ? { stages: stageSeries(seasonId, normalizedDivision), places: placeSeries(seasonId, normalizedDivision) }
        : { careerBySeason: seasonSeries(), places: placeSeries(null, null) },
      h2h: { career: h2hCareer, scoped: scopedH2h },
      matches,
    };
  }

  const contexts: Record<string, PlayerProfileContextData> = {};
  const add = (s: string | null, d: number | null) => {
    const c = buildContext(s, d);
    contexts[c.key] = c;
  };
  add(null, null);
  for (const seasonId of seasonsList) {
    add(seasonId, null);
    for (const div of divisionsBySeason[seasonId] ?? []) add(seasonId, div.id);
  }

  const normalized = normalizePlayerProfileContext(query, seasonsList, divisionsBySeason);

  return {
    player,
    careerStats,
    careerPlaces: placeDistribution(data.results),
    divisionPlaces: currentDivisionPlaces(leagues, rid, player.divisions),
    active: seasonsList.includes(CURRENT_SEASON),
    roster: buildRoster(leagues, rid),
    filters: {
      seasons: seasonsList.map((seasonId) => ({ id: seasonId, label: seasonId, isCurrent: seasonId === CURRENT_SEASON })),
      divisionsBySeason,
    },
    contexts,
    initialContextKey: normalized.key,
  };
}
