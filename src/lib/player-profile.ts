import {
  CURRENT_SEASON,
  getRatingRows,
  type League,
  type MockPlayer,
  type MockResult,
  type RealMatch,
} from "@/lib/mock/league";

export type PlayerProfileStatsScope = "career" | "season" | "season_division";
export type SampleSizeLevel = "very_low" | "low" | "medium" | "high";
export type MatchupStatus =
  | "very_comfortable"
  | "comfortable"
  | "equal"
  | "uncomfortable"
  | "very_uncomfortable"
  | "not_enough_data";

export type PlayerProfilePlayer = {
  rid: string;
  name: string;
  rankedinName: string;
  initials: string;
  color: string;
  skill: number;
  rank: number;
  divisions: number[];
  rankedInUrl: string;
};

export type PlayerProfileStats = {
  seasonsPlayed: number;
  stagesPlayed: number;
  divisionsPlayed: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  ralliesPlayed: number;
  ralliesWon: number;
  ralliesLost: number;
  matchWinRatePct: number | null;
  gameWinRatePct: number | null;
  rallyWinRatePct: number | null;
  gameBalance: number;
  rallyBalance: number;
  gameBalancePerMatch: number | null;
  rallyBalancePerMatch: number | null;
  wins3_0: number;
  wins3_1: number;
  wins3_2: number;
  losses2_3: number;
  losses1_3: number;
  losses0_3: number;
  cleanWins: number;
  cleanLosses: number;
  cleanWinRatePct: number | null;
  cleanLossRatePct: number | null;
  fiveGameMatches: number;
  fiveGameMatchesWon: number;
  fiveGameMatchesLost: number;
  fiveGameMatchRatePct: number | null;
  fiveGameWinRatePct: number | null;
  fifthGameRalliesWon: number;
  fifthGameRalliesLost: number;
  fifthGameRallyWinRatePct: number | null;
  closeGamesPlayed: number;
  closeGamesWon: number;
  closeGamesLost: number;
  closeGameRatePct: number | null;
  closeGameWinRatePct: number | null;
  overtimeGamesPlayed: number;
  overtimeGamesWon: number;
  overtimeGamesLost: number;
  overtimeGameRatePct: number | null;
  overtimeGameWinRatePct: number | null;
  dominantGamesWon: number;
  heavyGamesLost: number;
  dominantGameWinRatePct: number | null;
  heavyGameLossRatePct: number | null;
  totalMatchDurationSec: number;
  avgMatchDurationSec: number | null;
  shortestMatchDurationSec: number | null;
  longestMatchDurationSec: number | null;
  avgGameDurationSec: number | null;
  avgSecondsPerRally: number | null;
  matchLoadScore: number | null;
  formIndex: number | null;
  matchConversionPp: number | null;
  gameConversionPp: number | null;
  resultConversionPp: number | null;
  matchesTrailed0_2: number;
  reverseSweepWins: number;
  reverseSweepWinRatePct: number | null;
  forcedFifthAfterTrailing0_2: number;
  forcedFifthRateAfterTrailing0_2Pct: number | null;
  matchesLostAfterTrailing0_2: number;
  gamesWonAfterTrailing0_2: number;
  avgGamesWonAfterTrailing0_2: number | null;
  matchesLed2_0: number;
  winsAfterLeading2_0: number;
  lossesAfterLeading2_0: number;
  blownTwoGameLeadRatePct: number | null;
  reverseSweepLosses: number;
  avgGamesWonPerMatch: number | null;
  avgGamesLostPerMatch: number | null;
  avgGamesPlayedPerMatch: number | null;
  avgRalliesWonPerMatch: number | null;
  avgRalliesLostPerMatch: number | null;
  avgRalliesPlayedPerMatch: number | null;
  avgMatchGamesWon: number | null;
  avgMatchGamesLost: number | null;
  avgRallyMarginPerGame: number | null;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  last5MatchesPlayed: number;
  last5MatchesWon: number;
  last5MatchesLost: number;
  last5MatchWinRatePct: number | null;
  last10MatchesPlayed: number;
  last10MatchesWon: number;
  last10MatchesLost: number;
  last10MatchWinRatePct: number | null;
  cumulativeGameBalance: number;
  cumulativeRallyBalance: number;
  statsReliabilityScore: number | null;
  sampleSizeLevel: SampleSizeLevel;
};

export type PlayerProfileSeriesPoint = PlayerProfileStats & {
  orderIndex: number;
  label: string;
  seasonId?: string;
  stage?: number;
  date?: string;
};

export type PlayerProfilePlacePoint = {
  orderIndex: number;
  label: string;
  seasonId: string;
  stage: number;
  divisionId: number;
  place: number;
  date?: string;
};

export type PlayerOpponentStats = {
  opponentRid: string;
  opponentName: string;
  opponentInitials: string;
  opponentColor: string;
  meetingsPlayed: number;
  h2hMatchesWon: number;
  h2hMatchesLost: number;
  h2hMatchWinRatePct: number | null;
  h2hGamesWon: number;
  h2hGamesLost: number;
  h2hGameWinRatePct: number | null;
  h2hRalliesWon: number;
  h2hRalliesLost: number;
  h2hRallyWinRatePct: number | null;
  h2hFiveGameMatchesWon: number;
  h2hFiveGameMatchesLost: number;
  h2hFiveGameWinRatePct: number | null;
  h2hAvgMatchDurationSec: number | null;
  matchupComfortIndex: number | null;
  matchupStatus: MatchupStatus;
  hasClosingProblem: boolean;
  hasPositiveTrend: boolean;
  isHighLoad: boolean;
};

export type MatchListItem = {
  id: string;
  seasonId: string;
  stage: number;
  playedAt: string;
  stageName: string;
  divisionId: number;
  divisionName: string;
  opponentRid: string;
  opponentName: string;
  result: "W" | "L";
  matchScore: string;
  fullScoreText: string;
  detail: { for: number; against: number }[];
  durationSec: number;
  gamesFor: number;
  gamesAgainst: number;
  ralliesFor: number;
  ralliesAgainst: number;
  isFiveGameMatch: boolean;
  isReverseSweep: boolean;
  isCloseMatch: boolean;
  retired: boolean;
};

export type PlayerProfileContext = {
  seasonId: string | null;
  divisionId: number | null;
  scope: PlayerProfileStatsScope;
  title: string;
  description: string;
};

export type PlayerProfileContextData = {
  key: string;
  context: PlayerProfileContext;
  scopedStats: PlayerProfileStats;
  chartSeries: {
    careerBySeason?: PlayerProfileSeriesPoint[];
    stages?: PlayerProfileSeriesPoint[];
    places?: PlayerProfilePlacePoint[];
  };
  h2h: {
    career: PlayerOpponentStats[];
    scoped: PlayerOpponentStats[];
  };
  matches: MatchListItem[];
};

export type PlayerProfilePlaces = { p1: number; p2: number; p3: number; other: number; total: number };
export type PlayerProfileDivisionPlace = { div: number; place: number | null };

export type PlayerProfileModel = {
  player: PlayerProfilePlayer;
  careerStats: PlayerProfileStats;
  /** Career place distribution over all stage results (unfiltered). */
  careerPlaces: PlayerProfilePlaces;
  /** Current-season standing place per division the player plays. */
  divisionPlaces: PlayerProfileDivisionPlace[];
  /** Whether the player took part in the current season. */
  active: boolean;
  /** Other players (excl. current), surname-sorted, for the quick switcher. */
  roster: { rid: string; name: string }[];
  filters: {
    seasons: { id: string; label: string; isCurrent: boolean }[];
    divisionsBySeason: Record<string, { id: number; label: string }[]>;
  };
  contexts: Record<string, PlayerProfileContextData>;
  initialContextKey: string;
};

export type PlayerProfileResponse = {
  player: PlayerProfilePlayer;
  careerStats: PlayerProfileStats;
  context: PlayerProfileContext;
  scopedStats: PlayerProfileStats;
  chartSeries: PlayerProfileContextData["chartSeries"];
  h2h: PlayerProfileContextData["h2h"];
  matches: MatchListItem[];
  filters: PlayerProfileModel["filters"];
};

type QueryInput = {
  seasonId?: string | null;
  divisionId?: string | number | null;
};

type PlayerResultRecord = MockResult & {
  seasonId: string;
};

type PlayerMatchRecord = MatchListItem & {
  order: number;
  opponentInitials: string;
  opponentColor: string;
  detail: { for: number; against: number }[];
};

const RANKEDIN_BASE = "https://rankedin.com";

function pct(won: number, total: number): number | null {
  return total > 0 ? (won / total) * 100 : null;
}

function ratio(value: number, total: number): number | null {
  return total > 0 ? value / total : null;
}

function sampleSize(matches: number): SampleSizeLevel {
  if (matches <= 2) return "very_low";
  if (matches <= 5) return "low";
  if (matches <= 10) return "medium";
  return "high";
}

function reliability(level: SampleSizeLevel): number {
  if (level === "high") return 1;
  if (level === "medium") return 0.72;
  if (level === "low") return 0.45;
  return 0.22;
}

function numberOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function seasonStart(label: string): number {
  const [start] = label.split("/");
  return Number(start) || 0;
}

export function contextKey(seasonId: string | null, divisionId: number | null): string {
  if (!seasonId) return "career";
  return divisionId ? `${seasonId}::${divisionId}` : seasonId;
}

function contextTitle(seasonId: string | null, divisionId: number | null): string {
  if (!seasonId) return "Все сезоны";
  if (divisionId) return `${seasonId} · Дивизион ${divisionId}`;
  return `${seasonId} · Все дивизионы`;
}

function contextDescription(seasonId: string | null, divisionId: number | null): string {
  if (!seasonId) return "Показана карьерная статистика игрока за все сезоны.";
  if (divisionId) return `Показана статистика игрока в Дивизионе ${divisionId} за сезон ${seasonId}.`;
  return `Показана статистика игрока за сезон ${seasonId}.`;
}

export function makeContext(seasonId: string | null, divisionId: number | null): PlayerProfileContext {
  return {
    seasonId,
    divisionId: seasonId ? divisionId : null,
    scope: !seasonId ? "career" : divisionId ? "season_division" : "season",
    title: contextTitle(seasonId, seasonId ? divisionId : null),
    description: contextDescription(seasonId, seasonId ? divisionId : null),
  };
}

export function normalizePlayerProfileContext(
  query: QueryInput,
  seasons: string[],
  divisionsBySeason: Record<string, { id: number; label: string }[]>,
): { seasonId: string | null; divisionId: number | null; key: string } {
  const requestedSeason = query.seasonId && query.seasonId !== "all" ? String(query.seasonId) : null;
  const seasonId = requestedSeason && seasons.includes(requestedSeason) ? requestedSeason : null;
  if (!seasonId) {
    return { seasonId: null, divisionId: null, key: contextKey(null, null) };
  }

  const rawDivision = query.divisionId === "all" || query.divisionId === undefined || query.divisionId === null
    ? null
    : Number(query.divisionId);
  const available = divisionsBySeason[seasonId]?.map((item) => item.id) ?? [];
  const divisionId = rawDivision && available.includes(rawDivision) ? rawDivision : null;
  return { seasonId, divisionId, key: contextKey(seasonId, divisionId) };
}

export function emptyStats(): PlayerProfileStats {
  return {
    seasonsPlayed: 0,
    stagesPlayed: 0,
    divisionsPlayed: 0,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    ralliesPlayed: 0,
    ralliesWon: 0,
    ralliesLost: 0,
    matchWinRatePct: null,
    gameWinRatePct: null,
    rallyWinRatePct: null,
    gameBalance: 0,
    rallyBalance: 0,
    gameBalancePerMatch: null,
    rallyBalancePerMatch: null,
    wins3_0: 0,
    wins3_1: 0,
    wins3_2: 0,
    losses2_3: 0,
    losses1_3: 0,
    losses0_3: 0,
    cleanWins: 0,
    cleanLosses: 0,
    cleanWinRatePct: null,
    cleanLossRatePct: null,
    fiveGameMatches: 0,
    fiveGameMatchesWon: 0,
    fiveGameMatchesLost: 0,
    fiveGameMatchRatePct: null,
    fiveGameWinRatePct: null,
    fifthGameRalliesWon: 0,
    fifthGameRalliesLost: 0,
    fifthGameRallyWinRatePct: null,
    closeGamesPlayed: 0,
    closeGamesWon: 0,
    closeGamesLost: 0,
    closeGameRatePct: null,
    closeGameWinRatePct: null,
    overtimeGamesPlayed: 0,
    overtimeGamesWon: 0,
    overtimeGamesLost: 0,
    overtimeGameRatePct: null,
    overtimeGameWinRatePct: null,
    dominantGamesWon: 0,
    heavyGamesLost: 0,
    dominantGameWinRatePct: null,
    heavyGameLossRatePct: null,
    totalMatchDurationSec: 0,
    avgMatchDurationSec: null,
    shortestMatchDurationSec: null,
    longestMatchDurationSec: null,
    avgGameDurationSec: null,
    avgSecondsPerRally: null,
    matchLoadScore: null,
    formIndex: null,
    matchConversionPp: null,
    gameConversionPp: null,
    resultConversionPp: null,
    matchesTrailed0_2: 0,
    reverseSweepWins: 0,
    reverseSweepWinRatePct: null,
    forcedFifthAfterTrailing0_2: 0,
    forcedFifthRateAfterTrailing0_2Pct: null,
    matchesLostAfterTrailing0_2: 0,
    gamesWonAfterTrailing0_2: 0,
    avgGamesWonAfterTrailing0_2: null,
    matchesLed2_0: 0,
    winsAfterLeading2_0: 0,
    lossesAfterLeading2_0: 0,
    blownTwoGameLeadRatePct: null,
    reverseSweepLosses: 0,
    avgGamesWonPerMatch: null,
    avgGamesLostPerMatch: null,
    avgGamesPlayedPerMatch: null,
    avgRalliesWonPerMatch: null,
    avgRalliesLostPerMatch: null,
    avgRalliesPlayedPerMatch: null,
    avgMatchGamesWon: null,
    avgMatchGamesLost: null,
    avgRallyMarginPerGame: null,
    currentWinStreak: 0,
    currentLossStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0,
    last5MatchesPlayed: 0,
    last5MatchesWon: 0,
    last5MatchesLost: 0,
    last5MatchWinRatePct: null,
    last10MatchesPlayed: 0,
    last10MatchesWon: 0,
    last10MatchesLost: 0,
    last10MatchWinRatePct: null,
    cumulativeGameBalance: 0,
    cumulativeRallyBalance: 0,
    statsReliabilityScore: reliability("very_low"),
    sampleSizeLevel: "very_low",
  };
}

function updateStreaks(records: PlayerMatchRecord[]) {
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let runResult: "W" | "L" | null = null;
  let run = 0;

  for (const record of records) {
    if (record.result === runResult) run += 1;
    else {
      runResult = record.result;
      run = 1;
    }
    if (record.result === "W") longestWinStreak = Math.max(longestWinStreak, run);
    else longestLossStreak = Math.max(longestLossStreak, run);
  }

  const newest = [...records].sort((a, b) => b.order - a.order);
  const first = newest[0]?.result ?? null;
  for (const record of newest) {
    if (record.result !== first) break;
    if (first === "W") currentWinStreak += 1;
    if (first === "L") currentLossStreak += 1;
  }
  return { currentWinStreak, currentLossStreak, longestWinStreak, longestLossStreak };
}

function aggregateStats(
  matches: PlayerMatchRecord[],
  results: PlayerResultRecord[],
): PlayerProfileStats {
  if (matches.length === 0 && results.length === 0) return emptyStats();

  const seasons = new Set<string>();
  const stages = new Set<string>();
  const divisions = new Set<number>();
  for (const r of results) {
    seasons.add(r.seasonId);
    stages.add(`${r.seasonId}:${r.stage}:${r.div}`);
    divisions.add(r.div);
  }
  for (const m of matches) {
    seasons.add(m.seasonId);
    stages.add(`${m.seasonId}:${m.stage}:${m.divisionId}`);
    divisions.add(m.divisionId);
  }

  const stats = emptyStats();
  stats.seasonsPlayed = seasons.size;
  stats.stagesPlayed = stages.size;
  stats.divisionsPlayed = divisions.size;
  stats.matchesPlayed = matches.length;

  const durations = matches.map((m) => m.durationSec).filter((v) => v > 0);
  for (const m of matches) {
    const won = m.result === "W";
    if (won) stats.matchesWon += 1;
    else stats.matchesLost += 1;

    stats.gamesWon += m.gamesFor;
    stats.gamesLost += m.gamesAgainst;
    stats.ralliesWon += m.ralliesFor;
    stats.ralliesLost += m.ralliesAgainst;
    stats.totalMatchDurationSec += m.durationSec;

    if (won && m.gamesFor === 3 && m.gamesAgainst === 0) stats.wins3_0 += 1;
    if (won && m.gamesFor === 3 && m.gamesAgainst === 1) stats.wins3_1 += 1;
    if (won && m.gamesFor === 3 && m.gamesAgainst === 2) stats.wins3_2 += 1;
    if (!won && m.gamesFor === 2 && m.gamesAgainst === 3) stats.losses2_3 += 1;
    if (!won && m.gamesFor === 1 && m.gamesAgainst === 3) stats.losses1_3 += 1;
    if (!won && m.gamesFor === 0 && m.gamesAgainst === 3) stats.losses0_3 += 1;

    if (m.gamesFor + m.gamesAgainst === 5) {
      stats.fiveGameMatches += 1;
      if (won) stats.fiveGameMatchesWon += 1;
      else stats.fiveGameMatchesLost += 1;
      const fifth = m.detail[4];
      if (fifth) {
        stats.fifthGameRalliesWon += fifth.for;
        stats.fifthGameRalliesLost += fifth.against;
      }
    }

    for (const game of m.detail) {
      const gameWon = game.for > game.against;
      const margin = game.for - game.against;
      if (Math.abs(margin) === 2) {
        stats.closeGamesPlayed += 1;
        if (gameWon) stats.closeGamesWon += 1;
        else stats.closeGamesLost += 1;
      }
      if (Math.max(game.for, game.against) >= 12) {
        stats.overtimeGamesPlayed += 1;
        if (gameWon) stats.overtimeGamesWon += 1;
        else stats.overtimeGamesLost += 1;
      }
      if (gameWon && margin >= 5) stats.dominantGamesWon += 1;
      if (!gameWon && Math.abs(margin) >= 5) stats.heavyGamesLost += 1;
    }

    const firstTwo = m.detail.slice(0, 2);
    const trailed0_2 = firstTwo.length === 2 && firstTwo.every((g) => g.for < g.against);
    const led2_0 = firstTwo.length === 2 && firstTwo.every((g) => g.for > g.against);
    if (trailed0_2) {
      stats.matchesTrailed0_2 += 1;
      stats.gamesWonAfterTrailing0_2 += m.gamesFor;
      if (m.detail.length >= 5) stats.forcedFifthAfterTrailing0_2 += 1;
      if (won) stats.reverseSweepWins += 1;
      else stats.matchesLostAfterTrailing0_2 += 1;
    }
    if (led2_0) {
      stats.matchesLed2_0 += 1;
      if (won) stats.winsAfterLeading2_0 += 1;
      else {
        stats.lossesAfterLeading2_0 += 1;
        stats.reverseSweepLosses += 1;
      }
    }
  }

  stats.gamesPlayed = stats.gamesWon + stats.gamesLost;
  stats.ralliesPlayed = stats.ralliesWon + stats.ralliesLost;
  stats.gameBalance = stats.gamesWon - stats.gamesLost;
  stats.rallyBalance = stats.ralliesWon - stats.ralliesLost;
  stats.cleanWins = stats.wins3_0;
  stats.cleanLosses = stats.losses0_3;

  stats.matchWinRatePct = pct(stats.matchesWon, stats.matchesPlayed);
  stats.gameWinRatePct = pct(stats.gamesWon, stats.gamesPlayed);
  stats.rallyWinRatePct = pct(stats.ralliesWon, stats.ralliesPlayed);
  stats.gameBalancePerMatch = ratio(stats.gameBalance, stats.matchesPlayed);
  stats.rallyBalancePerMatch = ratio(stats.rallyBalance, stats.matchesPlayed);
  stats.cleanWinRatePct = pct(stats.cleanWins, stats.matchesWon);
  stats.cleanLossRatePct = pct(stats.cleanLosses, stats.matchesLost);
  stats.fiveGameMatchRatePct = pct(stats.fiveGameMatches, stats.matchesPlayed);
  stats.fiveGameWinRatePct = pct(stats.fiveGameMatchesWon, stats.fiveGameMatches);
  stats.fifthGameRallyWinRatePct = pct(stats.fifthGameRalliesWon, stats.fifthGameRalliesWon + stats.fifthGameRalliesLost);
  stats.closeGameRatePct = pct(stats.closeGamesPlayed, stats.gamesPlayed);
  stats.closeGameWinRatePct = pct(stats.closeGamesWon, stats.closeGamesPlayed);
  stats.overtimeGameRatePct = pct(stats.overtimeGamesPlayed, stats.gamesPlayed);
  stats.overtimeGameWinRatePct = pct(stats.overtimeGamesWon, stats.overtimeGamesPlayed);
  stats.dominantGameWinRatePct = pct(stats.dominantGamesWon, stats.gamesWon);
  stats.heavyGameLossRatePct = pct(stats.heavyGamesLost, stats.gamesLost);
  stats.avgMatchDurationSec = ratio(stats.totalMatchDurationSec, stats.matchesPlayed);
  stats.shortestMatchDurationSec = durations.length ? Math.min(...durations) : null;
  stats.longestMatchDurationSec = durations.length ? Math.max(...durations) : null;
  stats.avgGameDurationSec = ratio(stats.totalMatchDurationSec, stats.gamesPlayed);
  stats.avgSecondsPerRally = ratio(stats.totalMatchDurationSec, stats.ralliesPlayed);
  stats.matchLoadScore = stats.avgMatchDurationSec === null ? null : numberOrNull((stats.avgMatchDurationSec / 60) * Math.sqrt(Math.max(1, stats.matchesPlayed)));

  const matchWr = stats.matchWinRatePct;
  const gameWr = stats.gameWinRatePct;
  const rallyWr = stats.rallyWinRatePct;
  stats.formIndex = numberOrNull((matchWr ?? 0) * 0.45 + (gameWr ?? 0) * 0.35 + (rallyWr ?? 0) * 0.2);
  stats.matchConversionPp = matchWr !== null && gameWr !== null ? matchWr - gameWr : null;
  stats.gameConversionPp = gameWr !== null && rallyWr !== null ? gameWr - rallyWr : null;
  stats.resultConversionPp = matchWr !== null && rallyWr !== null ? matchWr - rallyWr : null;

  stats.reverseSweepWinRatePct = pct(stats.reverseSweepWins, stats.matchesTrailed0_2);
  stats.forcedFifthRateAfterTrailing0_2Pct = pct(stats.forcedFifthAfterTrailing0_2, stats.matchesTrailed0_2);
  stats.avgGamesWonAfterTrailing0_2 = ratio(stats.gamesWonAfterTrailing0_2, stats.matchesTrailed0_2);
  stats.blownTwoGameLeadRatePct = pct(stats.lossesAfterLeading2_0, stats.matchesLed2_0);

  stats.avgGamesWonPerMatch = ratio(stats.gamesWon, stats.matchesPlayed);
  stats.avgGamesLostPerMatch = ratio(stats.gamesLost, stats.matchesPlayed);
  stats.avgGamesPlayedPerMatch = ratio(stats.gamesPlayed, stats.matchesPlayed);
  stats.avgRalliesWonPerMatch = ratio(stats.ralliesWon, stats.matchesPlayed);
  stats.avgRalliesLostPerMatch = ratio(stats.ralliesLost, stats.matchesPlayed);
  stats.avgRalliesPlayedPerMatch = ratio(stats.ralliesPlayed, stats.matchesPlayed);
  stats.avgMatchGamesWon = stats.avgGamesWonPerMatch;
  stats.avgMatchGamesLost = stats.avgGamesLostPerMatch;
  stats.avgRallyMarginPerGame = ratio(stats.rallyBalance, stats.gamesPlayed);

  const ordered = [...matches].sort((a, b) => a.order - b.order);
  Object.assign(stats, updateStreaks(ordered));
  const last5 = [...ordered].slice(-5);
  const last10 = [...ordered].slice(-10);
  stats.last5MatchesPlayed = last5.length;
  stats.last5MatchesWon = last5.filter((m) => m.result === "W").length;
  stats.last5MatchesLost = last5.length - stats.last5MatchesWon;
  stats.last5MatchWinRatePct = pct(stats.last5MatchesWon, last5.length);
  stats.last10MatchesPlayed = last10.length;
  stats.last10MatchesWon = last10.filter((m) => m.result === "W").length;
  stats.last10MatchesLost = last10.length - stats.last10MatchesWon;
  stats.last10MatchWinRatePct = pct(stats.last10MatchesWon, last10.length);
  stats.cumulativeGameBalance = stats.gameBalance;
  stats.cumulativeRallyBalance = stats.rallyBalance;
  stats.sampleSizeLevel = sampleSize(stats.matchesPlayed);
  stats.statsReliabilityScore = reliability(stats.sampleSizeLevel);

  return stats;
}

function matchOrder(seasonId: string, stage: number, index: number): number {
  return seasonStart(seasonId) * 10000 + stage * 100 + index;
}

function fullScoreText(detail: { for: number; against: number }[]): string {
  return detail.length ? detail.map((g) => `${g.for}:${g.against}`).join(" · ") : "x";
}

function stageDate(league: League, stage: number): string {
  return league.stages.find((s) => s.no === stage)?.date ?? "";
}

function toMatchRecord(
  league: League,
  seasonId: string,
  match: RealMatch,
  playerIdx: number,
  index: number,
): PlayerMatchRecord {
  const isA = match.aIdx === playerIdx;
  const opponent = league.players[isA ? match.bIdx : match.aIdx];
  const gamesFor = isA ? match.gamesA : match.gamesB;
  const gamesAgainst = isA ? match.gamesB : match.gamesA;
  const detail = match.detail.map((g) => ({ for: isA ? g.a : g.b, against: isA ? g.b : g.a }));
  const ralliesFor = detail.reduce((sum, g) => sum + g.for, 0);
  const ralliesAgainst = detail.reduce((sum, g) => sum + g.against, 0);
  const result = match.winnerIdx === playerIdx || gamesFor > gamesAgainst ? "W" : "L";
  const trailed0_2 = detail.slice(0, 2).length === 2 && detail.slice(0, 2).every((g) => g.for < g.against);
  const isReverseSweep = trailed0_2 && result === "W" && detail.length >= 5;
  const playedAt = stageDate(league, match.stage);
  const closeGamesCount = detail.filter((g) => Math.abs(g.for - g.against) === 2).length;
  const isCloseMatch = closeGamesCount >= 3;

  return {
    id: `${seasonId}-${match.stage}-${match.division}-${match.aIdx}-${match.bIdx}-${index}`,
    seasonId,
    stage: match.stage,
    playedAt,
    stageName: `Этап ${match.stage}`,
    divisionId: match.division,
    divisionName: `Дивизион ${match.division}`,
    opponentRid: opponent?.rid ?? String(isA ? match.bIdx : match.aIdx),
    opponentName: opponent?.name ?? " - ",
    opponentInitials: opponent?.initials ?? " - ",
    opponentColor: opponent?.color ?? "var(--m3-surface-container-high)",
    result,
    matchScore: `${gamesFor}:${gamesAgainst}`,
    fullScoreText: fullScoreText(detail),
    durationSec: (match.durationMin ?? 0) * 60,
    gamesFor,
    gamesAgainst,
    ralliesFor,
    ralliesAgainst,
    isFiveGameMatch: gamesFor + gamesAgainst === 5,
    isReverseSweep,
    isCloseMatch,
    retired: Boolean(match.retired),
    order: matchOrder(seasonId, match.stage, index),
    detail,
  };
}

export function collectPlayerData(leagues: Record<string, League>, rid: string) {
  let player: MockPlayer | null = null;
  const results: PlayerResultRecord[] = [];
  const matches: PlayerMatchRecord[] = [];

  for (const [seasonId, league] of Object.entries(leagues)) {
    const p = league.players.find((item) => item.rid === rid);
    if (!p) continue;
    if (!player || seasonId === CURRENT_SEASON) player = p;
    for (const result of league.results) {
      if (result.playerIdx === p.idx) results.push({ ...result, seasonId });
    }
    league.matches.forEach((match, index) => {
      if (match.aIdx === p.idx || match.bIdx === p.idx) {
        matches.push(toMatchRecord(league, seasonId, match, p.idx, index));
      }
    });
  }

  return { player, results, matches };
}

export function filterMatches(matches: PlayerMatchRecord[], seasonId: string | null, divisionId: number | null) {
  return matches.filter(
    (m) =>
      (!seasonId || m.seasonId === seasonId) &&
      (!divisionId || m.divisionId === divisionId),
  );
}

function filterResults(results: PlayerResultRecord[], seasonId: string | null, divisionId: number | null) {
  return results.filter(
    (r) =>
      (!seasonId || r.seasonId === seasonId) &&
      (!divisionId || r.div === divisionId),
  );
}

function buildSeasonSeries(
  seasons: string[],
  matches: PlayerMatchRecord[],
  results: PlayerResultRecord[],
): PlayerProfileSeriesPoint[] {
  return [...seasons]
    .sort((a, b) => seasonStart(a) - seasonStart(b))
    .map((seasonId, index) => ({
      ...aggregateStats(filterMatches(matches, seasonId, null), filterResults(results, seasonId, null)),
      orderIndex: index + 1,
      label: seasonId,
      seasonId,
    }));
}

function buildStageSeries(
  league: League | undefined,
  seasonId: string,
  divisionId: number | null,
  matches: PlayerMatchRecord[],
  results: PlayerResultRecord[],
): PlayerProfileSeriesPoint[] {
  return Array.from({ length: 9 }, (_, i) => {
    const stage = i + 1;
    const stageMatches = matches.filter(
      (m) => m.seasonId === seasonId && m.stage === stage && (!divisionId || m.divisionId === divisionId),
    );
    const stageResults = results.filter(
      (r) => r.seasonId === seasonId && r.stage === stage && (!divisionId || r.div === divisionId),
    );
    return {
      ...aggregateStats(stageMatches, stageResults),
      orderIndex: stage,
      label: `Этап ${stage}`,
      seasonId,
      stage,
      date: league?.stages.find((s) => s.no === stage)?.date,
    };
  });
}

function buildPlaceSeries(
  leagues: Record<string, League>,
  results: PlayerResultRecord[],
  seasonId: string | null,
  divisionId: number | null,
): PlayerProfilePlacePoint[] {
  return filterResults(results, seasonId, divisionId)
    .filter((r) => r.place > 0)
    .sort((a, b) => seasonStart(a.seasonId) - seasonStart(b.seasonId) || a.stage - b.stage || a.div - b.div)
    .map((r, index) => {
      const league = leagues[r.seasonId];
      return {
        orderIndex: index + 1,
        label: seasonId ? (divisionId ? `Э${r.stage}` : `Э${r.stage} · Д${r.div}`) : `${r.seasonId} · Э${r.stage} · Д${r.div}`,
        seasonId: r.seasonId,
        stage: r.stage,
        divisionId: r.div,
        place: r.place,
        date: league ? stageDate(league, r.stage) : r.date,
      };
    });
}

function matchupStatus(stats: PlayerProfileStats): MatchupStatus {
  if (stats.matchesPlayed < 2 || stats.matchWinRatePct === null) return "not_enough_data";
  if (stats.matchWinRatePct >= 70) return "very_comfortable";
  if (stats.matchWinRatePct >= 55) return "comfortable";
  if (stats.matchWinRatePct >= 45) return "equal";
  if (stats.matchWinRatePct >= 30) return "uncomfortable";
  return "very_uncomfortable";
}

function buildH2h(matches: PlayerMatchRecord[]): PlayerOpponentStats[] {
  const grouped = new Map<string, PlayerMatchRecord[]>();
  for (const match of matches) {
    const list = grouped.get(match.opponentRid) ?? [];
    list.push(match);
    grouped.set(match.opponentRid, list);
  }

  return [...grouped.entries()]
    .map(([opponentRid, list]) => {
      const stats = aggregateStats(list, []);
      const recent = [...list].sort((a, b) => b.order - a.order).slice(0, 5);
      const recentWr = pct(recent.filter((m) => m.result === "W").length, recent.length);
      const baseWr = stats.matchWinRatePct ?? 0;
      return {
        opponentRid,
        opponentName: list[0]?.opponentName ?? " - ",
        opponentInitials: list[0]?.opponentInitials ?? " - ",
        opponentColor: list[0]?.opponentColor ?? "var(--m3-surface-container-high)",
        meetingsPlayed: stats.matchesPlayed,
        h2hMatchesWon: stats.matchesWon,
        h2hMatchesLost: stats.matchesLost,
        h2hMatchWinRatePct: stats.matchWinRatePct,
        h2hGamesWon: stats.gamesWon,
        h2hGamesLost: stats.gamesLost,
        h2hGameWinRatePct: stats.gameWinRatePct,
        h2hRalliesWon: stats.ralliesWon,
        h2hRalliesLost: stats.ralliesLost,
        h2hRallyWinRatePct: stats.rallyWinRatePct,
        h2hFiveGameMatchesWon: stats.fiveGameMatchesWon,
        h2hFiveGameMatchesLost: stats.fiveGameMatchesLost,
        h2hFiveGameWinRatePct: stats.fiveGameWinRatePct,
        h2hAvgMatchDurationSec: stats.avgMatchDurationSec,
        matchupComfortIndex: stats.formIndex === null ? null : stats.formIndex - 50,
        matchupStatus: matchupStatus(stats),
        hasClosingProblem: (stats.fiveGameMatches >= 2 && (stats.fiveGameWinRatePct ?? 0) < 50) || stats.lossesAfterLeading2_0 > 0,
        hasPositiveTrend: recentWr !== null && recent.length >= 3 && recentWr > baseWr + 15,
        isHighLoad: (stats.avgMatchDurationSec ?? 0) >= 45 * 60,
      };
    })
    .sort((a, b) => b.meetingsPlayed - a.meetingsPlayed);
}

/**
 * Full H2H stats for a single opponent, from the current player's perspective,
 * recomputed from the raw meeting list. Reuses the same aggregation as the
 * profile, so every derived metric (score distribution, decisive moments,
 * comebacks, time/load, recent form) is available without new DB columns.
 */
export function h2hStatsFromMatches(matches: MatchListItem[]): PlayerProfileStats {
  const chrono = [...matches].sort(
    (a, b) => seasonStart(a.seasonId) - seasonStart(b.seasonId) || a.stage - b.stage,
  );
  const records: PlayerMatchRecord[] = chrono.map((m, i) => ({
    ...m,
    order: i,
    opponentInitials: "",
    opponentColor: "",
  }));
  return aggregateStats(records, []);
}

export function placeDistribution(results: { place: number }[]): PlayerProfilePlaces {
  const out: PlayerProfilePlaces = { p1: 0, p2: 0, p3: 0, other: 0, total: results.length };
  for (const r of results) {
    if (r.place === 1) out.p1 += 1;
    else if (r.place === 2) out.p2 += 1;
    else if (r.place === 3) out.p3 += 1;
    else out.other += 1;
  }
  return out;
}

/** Current-season standing place per division (null when unranked there). */
export function currentDivisionPlaces(
  leagues: Record<string, League>,
  rid: string,
  divisions: number[],
): PlayerProfileDivisionPlace[] {
  const cur = leagues[CURRENT_SEASON];
  return divisions.map((div) => ({
    div,
    place: cur ? getRatingRows(cur, div as 1 | 2 | 3).find((r) => r.rid === rid)?.place ?? null : null,
  }));
}

/** All players (excl. `excludeRid`), unique by rid, sorted by surname. */
export function buildRoster(leagues: Record<string, League>, excludeRid: string): { rid: string; name: string }[] {
  const surname = (n: string) => n.trim().split(/\s+/).at(-1) ?? n;
  const map = new Map<string, string>();
  for (const lg of Object.values(leagues)) {
    for (const p of lg.players) {
      if (p.rid !== excludeRid && !map.has(p.rid)) map.set(p.rid, p.name);
    }
  }
  return [...map.entries()]
    .map(([rid, name]) => ({ rid, name }))
    .sort((a, b) => surname(a.name).localeCompare(surname(b.name), "ru"));
}

export function buildDivisionsBySeason(results: PlayerResultRecord[]) {
  const out: Record<string, { id: number; label: string }[]> = {};
  for (const result of results) {
    const list = out[result.seasonId] ?? [];
    if (!list.some((item) => item.id === result.div)) {
      list.push({ id: result.div, label: `Дивизион ${result.div}` });
    }
    out[result.seasonId] = list.sort((a, b) => a.id - b.id);
  }
  return out;
}

function buildContextData(
  leagues: Record<string, League>,
  seasons: string[],
  matches: PlayerMatchRecord[],
  results: PlayerResultRecord[],
  h2hCareer: PlayerOpponentStats[],
  seasonId: string | null,
  divisionId: number | null,
): PlayerProfileContextData {
  const normalizedDivision = seasonId ? divisionId : null;
  const scopedMatches = filterMatches(matches, seasonId, normalizedDivision).sort((a, b) => b.order - a.order);
  const scopedResults = filterResults(results, seasonId, normalizedDivision);
  const context = makeContext(seasonId, normalizedDivision);
  return {
    key: contextKey(seasonId, normalizedDivision),
    context,
    scopedStats: aggregateStats(scopedMatches, scopedResults),
    chartSeries: seasonId
      ? {
          stages: buildStageSeries(leagues[seasonId], seasonId, normalizedDivision, matches, results),
          places: buildPlaceSeries(leagues, results, seasonId, normalizedDivision),
        }
      : {
          careerBySeason: buildSeasonSeries(seasons, matches, results),
          places: buildPlaceSeries(leagues, results, null, null),
        },
    h2h: {
      career: h2hCareer,
      scoped: buildH2h(scopedMatches),
    },
    matches: scopedMatches,
  };
}

export function pickPlayerSnapshot(data: ReturnType<typeof collectPlayerData>): PlayerProfilePlayer | null {
  if (!data.player) return null;
  const divisions = [...new Set(data.results.map((r) => r.div))].sort((a, b) => a - b);
  return {
    rid: data.player.rid,
    name: data.player.name,
    rankedinName: data.player.rankedinName,
    initials: data.player.initials,
    color: data.player.color,
    skill: data.player.skill,
    rank: data.player.rank,
    divisions,
    rankedInUrl: `${RANKEDIN_BASE}/ru/player/${data.player.rid}`,
  };
}

export function resolveProfilePlayerRid(id: string, leagues: Record<string, League>): string | null {
  const decoded = decodeURIComponent(id);
  for (const league of Object.values(leagues)) {
    if (league.players.some((player) => player.rid === decoded)) return decoded;
  }

  const legacyIdx = Number(decoded);
  if (!Number.isInteger(legacyIdx) || legacyIdx < 0) return null;
  const currentPlayer = leagues[CURRENT_SEASON]?.players[legacyIdx];
  if (currentPlayer) return currentPlayer.rid;
  for (const league of Object.values(leagues)) {
    const player = league.players[legacyIdx];
    if (player) return player.rid;
  }
  return null;
}

export function buildPlayerProfileModel(
  leagues: Record<string, League>,
  rid: string,
  query: QueryInput = {},
): PlayerProfileModel | null {
  const data = collectPlayerData(leagues, rid);
  const player = pickPlayerSnapshot(data);
  if (!player) return null;

  const seasons = [...new Set([...data.results.map((r) => r.seasonId), ...data.matches.map((m) => m.seasonId)])]
    .sort((a, b) => seasonStart(b) - seasonStart(a));
  const divisionsBySeason = buildDivisionsBySeason(data.results);
  const careerMatches = filterMatches(data.matches, null, null).sort((a, b) => b.order - a.order);
  const careerStats = aggregateStats(careerMatches, data.results);
  const h2hCareer = buildH2h(careerMatches);
  const contexts: Record<string, PlayerProfileContextData> = {};

  const addContext = (seasonId: string | null, divisionId: number | null) => {
    const dataForContext = buildContextData(
      leagues,
      seasons,
      data.matches,
      data.results,
      h2hCareer,
      seasonId,
      divisionId,
    );
    contexts[dataForContext.key] = dataForContext;
  };

  addContext(null, null);
  for (const seasonId of seasons) {
    addContext(seasonId, null);
    for (const div of divisionsBySeason[seasonId] ?? []) addContext(seasonId, div.id);
  }

  const normalized = normalizePlayerProfileContext(query, seasons, divisionsBySeason);

  return {
    player,
    careerStats,
    careerPlaces: placeDistribution(data.results),
    divisionPlaces: currentDivisionPlaces(leagues, rid, player.divisions),
    active: seasons.includes(CURRENT_SEASON),
    roster: buildRoster(leagues, rid),
    filters: {
      seasons: seasons.map((seasonId) => ({ id: seasonId, label: seasonId, isCurrent: seasonId === CURRENT_SEASON })),
      divisionsBySeason,
    },
    contexts,
    initialContextKey: normalized.key,
  };
}

export function profileResponseFromModel(model: PlayerProfileModel, key = model.initialContextKey): PlayerProfileResponse {
  const context = model.contexts[key] ?? model.contexts.career;
  return {
    player: model.player,
    careerStats: model.careerStats,
    context: context.context,
    scopedStats: context.scopedStats,
    chartSeries: context.chartSeries,
    h2h: context.h2h,
    matches: context.matches,
    filters: model.filters,
  };
}
