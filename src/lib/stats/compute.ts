/**
 * Pure statistics core. No DB, no Drizzle — operates on plain match/game
 * shapes so every formula is unit-testable. The DB layer (recalc.ts) maps
 * rows into these shapes and serializes the result into the aggregate table.
 *
 * Phase 1 scope: volume counters, Match/Game/Rally WR, balances and the
 * best-of-5 score distribution. See the data-model brief sections 7.2–7.6.
 */

export type GamePair = { a: number; b: number };

export type MatchScoreCode = "3:0" | "3:1" | "3:2" | "2:3" | "1:3" | "0:3";

export type MatchResultCode = "W" | "L";

export type SampleSizeLevel = "very_low" | "low" | "medium" | "high";

export type MatchupStatus =
  | "very_comfortable"
  | "comfortable"
  | "equal"
  | "uncomfortable"
  | "very_uncomfortable"
  | "not_enough_data";

/** Match as the calculator needs it, independent of storage. */
export type MatchForStats = {
  /** Games won by side A / B (authoritative match result). */
  gamesA: number;
  gamesB: number;
  /** Per-game ball scores; may be empty when only the game tally is known. */
  games: GamePair[];
  /** Total match duration in seconds (0/undefined when unknown). */
  durationSec?: number | null;
  /** When the match was played (drives first/last and ordering). */
  playedAt?: Date | null;
};

/** One match seen from a single player's point of view. */
export type MatchPerspective = {
  isWin: boolean;
  gamesWon: number;
  gamesLost: number;
  ralliesWon: number;
  ralliesLost: number;
  matchScore: MatchScoreCode;
  durationSec: number;
  isFiveGame: boolean;
  // per-game tallies from this player's perspective
  closeGamesWon: number;
  closeGamesLost: number;
  overtimeGamesWon: number;
  overtimeGamesLost: number;
  dominantGamesWon: number;
  heavyGamesLost: number;
  fifthGameRalliesWon: number;
  fifthGameRalliesLost: number;
  // comeback signals (0:2 trail / 2:0 lead) from this player's perspective
  trailed0_2: boolean;
  led2_0: boolean;
  reverseSweepWin: boolean;
  reverseSweepLoss: boolean;
  forcedFifthAfterTrailing0_2: boolean;
  lostAfterTrailing0_2: boolean;
  winAfterLeading2_0: boolean;
  lossAfterLeading2_0: boolean;
  gamesWonAfterTrailing0_2: number;
  playedAt?: Date | null;
};

/** Derived flags for a single game from its raw score. */
export type GameFlags = {
  pointMargin: number;
  winnerIsA: boolean;
  isCloseGame: boolean;
  isOvertimeGame: boolean;
  isDominantGame: boolean;
};

/** Percentage helper that is null-safe against a zero denominator. */
export function pct(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * 100;
}

/** Average helper, null when there is nothing to divide by. */
export function avg(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

export function gameFlags(a: number, b: number): GameFlags {
  const margin = Math.abs(a - b);
  return {
    pointMargin: margin,
    winnerIsA: a > b,
    isCloseGame: margin === 2,
    isOvertimeGame: Math.max(a, b) > 11,
    isDominantGame: margin >= 5,
  };
}

/**
 * Match-level comeback flags from the per-game sequence. In squash best-of-5
 * the telling story is the 0:2 trail (and the symmetric 2:0 blown lead), not
 * the first game alone.
 */
export type MatchComebackFlags = {
  playerATrailed0_2: boolean;
  playerBTrailed0_2: boolean;
  playerALed2_0: boolean;
  playerBLed2_0: boolean;
  /** A 0:2 trailer won the match 3:2. */
  isReverseSweep: boolean;
  /** A 0:2 trailer leveled to 2:2 (a 5th game was forced), regardless of result. */
  wasFifthForcedAfter0_2: boolean;
  /** Side that completed the reverse sweep, or null when there was none. */
  reverseSweepWinnerIsA: boolean | null;
};

export function matchComebackFlags(
  games: GamePair[],
  gamesA: number,
  gamesB: number,
): MatchComebackFlags {
  const blank: MatchComebackFlags = {
    playerATrailed0_2: false,
    playerBTrailed0_2: false,
    playerALed2_0: false,
    playerBLed2_0: false,
    isReverseSweep: false,
    wasFifthForcedAfter0_2: false,
    reverseSweepWinnerIsA: null,
  };
  if (games.length < 2) return blank;

  const aWon0 = games[0].a > games[0].b;
  const aWon1 = games[1].a > games[1].b;
  const playerALed2_0 = aWon0 && aWon1;
  const playerBLed2_0 = !aWon0 && !aWon1;
  const playerATrailed0_2 = playerBLed2_0;
  const playerBTrailed0_2 = playerALed2_0;

  const fiveGames = gamesA + gamesB === 5;
  const wasFifthForcedAfter0_2 = (playerATrailed0_2 || playerBTrailed0_2) && fiveGames;

  const aWonMatch = gamesA > gamesB;
  const isReverseSweep =
    (playerATrailed0_2 && aWonMatch && gamesA === 3 && gamesB === 2) ||
    (playerBTrailed0_2 && !aWonMatch && gamesB === 3 && gamesA === 2);
  const reverseSweepWinnerIsA = isReverseSweep ? playerATrailed0_2 && aWonMatch : null;

  return {
    playerATrailed0_2,
    playerBTrailed0_2,
    playerALed2_0,
    playerBLed2_0,
    isReverseSweep,
    wasFifthForcedAfter0_2,
    reverseSweepWinnerIsA,
  };
}

function scoreCode(gamesWon: number, gamesLost: number): MatchScoreCode {
  return `${gamesWon}:${gamesLost}` as MatchScoreCode;
}

/**
 * Project a match onto one player. `asA` true means the player is side A.
 * Games come from the authoritative tally; rallies are summed from per-game
 * scores (0 when detail is absent — rally percentages then resolve to null).
 */
export function perspective(match: MatchForStats, asA: boolean): MatchPerspective {
  const gamesWon = asA ? match.gamesA : match.gamesB;
  const gamesLost = asA ? match.gamesB : match.gamesA;
  let ralliesWon = 0;
  let ralliesLost = 0;
  let closeGamesWon = 0;
  let closeGamesLost = 0;
  let overtimeGamesWon = 0;
  let overtimeGamesLost = 0;
  let dominantGamesWon = 0;
  let heavyGamesLost = 0;
  for (const g of match.games) {
    const p = asA ? g.a : g.b;
    const o = asA ? g.b : g.a;
    ralliesWon += p;
    ralliesLost += o;
    const margin = Math.abs(p - o);
    const won = p > o;
    const isClose = margin === 2;
    const isOvertime = Math.max(p, o) > 11;
    if (won) {
      if (isClose) closeGamesWon += 1;
      if (isOvertime) overtimeGamesWon += 1;
      if (margin >= 5) dominantGamesWon += 1;
    } else {
      if (isClose) closeGamesLost += 1;
      if (isOvertime) overtimeGamesLost += 1;
      if (margin >= 5) heavyGamesLost += 1;
    }
  }
  const isFiveGame = gamesWon + gamesLost === 5;
  let fifthGameRalliesWon = 0;
  let fifthGameRalliesLost = 0;
  if (isFiveGame && match.games.length === 5) {
    const g = match.games[4];
    fifthGameRalliesWon = asA ? g.a : g.b;
    fifthGameRalliesLost = asA ? g.b : g.a;
  }

  const isWin = gamesWon > gamesLost;
  const cf = matchComebackFlags(match.games, match.gamesA, match.gamesB);
  const trailed0_2 = asA ? cf.playerATrailed0_2 : cf.playerBTrailed0_2;
  const led2_0 = asA ? cf.playerALed2_0 : cf.playerBLed2_0;
  let gamesWonAfterTrailing0_2 = 0;
  if (trailed0_2) {
    for (let i = 2; i < match.games.length; i++) {
      const won = asA ? match.games[i].a > match.games[i].b : match.games[i].b > match.games[i].a;
      if (won) gamesWonAfterTrailing0_2 += 1;
    }
  }

  return {
    isWin,
    gamesWon,
    gamesLost,
    ralliesWon,
    ralliesLost,
    matchScore: scoreCode(gamesWon, gamesLost),
    durationSec: match.durationSec ?? 0,
    isFiveGame,
    closeGamesWon,
    closeGamesLost,
    overtimeGamesWon,
    overtimeGamesLost,
    dominantGamesWon,
    heavyGamesLost,
    fifthGameRalliesWon,
    fifthGameRalliesLost,
    trailed0_2,
    led2_0,
    reverseSweepWin: trailed0_2 && gamesWon === 3 && gamesLost === 2,
    reverseSweepLoss: led2_0 && gamesWon === 2 && gamesLost === 3,
    forcedFifthAfterTrailing0_2: trailed0_2 && gamesWon + gamesLost === 5,
    lostAfterTrailing0_2: trailed0_2 && !isWin,
    winAfterLeading2_0: led2_0 && isWin,
    lossAfterLeading2_0: led2_0 && !isWin,
    gamesWonAfterTrailing0_2,
    playedAt: match.playedAt ?? null,
  };
}

/** Phase 1 aggregate, all values as numbers (percentages nullable). */
export type ComputedAggregate = {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  ralliesPlayed: number;
  ralliesWon: number;
  ralliesLost: number;
  firstMatchAt: Date | null;
  lastMatchAt: Date | null;

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

  // five-game matches
  fiveGameMatches: number;
  fiveGameMatchesWon: number;
  fiveGameMatchesLost: number;
  fiveGameMatchRatePct: number | null;
  fiveGameWinRatePct: number | null;
  fifthGameRalliesWon: number;
  fifthGameRalliesLost: number;
  fifthGameRallyWinRatePct: number | null;

  // close & overtime games
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

  // dominant & heavy-lost games
  dominantGamesWon: number;
  heavyGamesLost: number;
  dominantGameWinRatePct: number | null;
  heavyGameLossRatePct: number | null;

  // time & load
  totalMatchDurationSec: number;
  avgMatchDurationSec: number | null;
  shortestMatchDurationSec: number | null;
  longestMatchDurationSec: number | null;
  avgGameDurationSec: number | null;
  avgSecondsPerRally: number | null;
  matchLoadScore: number | null;

  // composite indexes
  formIndex: number | null;
  skillIndex: number | null;
  skillIndexStatus: SkillIndexStatus | null;
  matchConversionPp: number | null;
  gameConversionPp: number | null;
  resultConversionPp: number | null;

  // comeback: trailing 0:2 / leading 2:0 (squash-relevant)
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

  // per-match averages (7.5)
  avgGamesWonPerMatch: number | null;
  avgGamesLostPerMatch: number | null;
  avgGamesPlayedPerMatch: number | null;
  avgRalliesWonPerMatch: number | null;
  avgRalliesLostPerMatch: number | null;
  avgRalliesPlayedPerMatch: number | null;
  avgMatchGamesWon: number | null;
  avgMatchGamesLost: number | null;
  avgRallyMarginPerGame: number | null;

  // streaks & recent form (7.13) — require chronological input
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  last5MatchesPlayed: number;
  last5MatchesWon: number;
  last5MatchesLost: number;
  last5MatchWinRatePct: number | null;
  last5GameWinRatePct: number | null;
  last5RallyWinRatePct: number | null;
  last10MatchesPlayed: number;
  last10MatchesWon: number;
  last10MatchesLost: number;
  last10MatchWinRatePct: number | null;
  last10GameWinRatePct: number | null;
  last10RallyWinRatePct: number | null;

  // trends & cumulative (7.14)
  matchWinRateTrendPp: number | null;
  gameWinRateTrendPp: number | null;
  rallyWinRateTrendPp: number | null;
  formIndexTrend: number | null;
  cumulativeGameBalance: number;
  cumulativeRallyBalance: number;

  // reliability (7.15)
  statsReliabilityScore: number | null;
};

function formIndexOf(matchWR: number | null, gameWR: number | null, rallyWR: number | null): number | null {
  if (matchWR === null) return null;
  return matchWR * 0.45 + (gameWR ?? 0) * 0.35 + (rallyWR ?? 0) * 0.2;
}

export type SkillIndexStatus =
  | "below_level"
  | "developing"
  | "competitive"
  | "good"
  | "strong"
  | "very_strong"
  | "dominant";

export type SkillIndexScaleItem = {
  min: number;
  max: number;
  status: SkillIndexStatus;
  labelRu: string;
  shortLabelRu: string;
  descriptionRu: string;
};

export const SKILL_INDEX_SCALE: SkillIndexScaleItem[] = [
  {
    min: 0,
    max: 44.9,
    status: "below_level",
    labelRu: "Ниже уровня",
    shortLabelRu: "Ниже уровня",
    descriptionRu: "Игрок заметно уступает по ключевым игровым показателям.",
  },
  {
    min: 45,
    max: 49.9,
    status: "developing",
    labelRu: "Развивается",
    shortLabelRu: "Развивается",
    descriptionRu: "Игрок уже конкурентен отдельными отрезками, но чаще уступает по качеству игры.",
  },
  {
    min: 50,
    max: 54.9,
    status: "competitive",
    labelRu: "Конкурентный",
    shortLabelRu: "Конкурентный",
    descriptionRu: "Игрок держит равный уровень и регулярно борется за победы.",
  },
  {
    min: 55,
    max: 59.9,
    status: "good",
    labelRu: "Хороший",
    shortLabelRu: "Хороший",
    descriptionRu: "Игрок имеет заметное игровое преимущество.",
  },
  {
    min: 60,
    max: 66.9,
    status: "strong",
    labelRu: "Сильный",
    shortLabelRu: "Сильный",
    descriptionRu: "Игрок стабильно превосходит большинство соперников в выбранной статистической выборке.",
  },
  {
    min: 67,
    max: 71.9,
    status: "very_strong",
    labelRu: "Очень сильный",
    shortLabelRu: "Очень сильный",
    descriptionRu: "Игрок показывает очень высокий игровой уровень по матчам, геймам и розыгрышам.",
  },
  {
    min: 72,
    max: 100,
    status: "dominant",
    labelRu: "Доминирующий",
    shortLabelRu: "Доминирующий",
    descriptionRu: "Игрок явно доминирует по качеству игры.",
  },
];

export type StrengthReliabilityStatus = "provisional" | "established";

export type StrengthBand = {
  min: number;
  /** Inclusive upper bound; `Infinity` for the top band. */
  max: number;
  labelRu: string;
  descriptionRu: string;
};

/**
 * Strength Rating gradation, shown only in the info popover (the badge itself
 * carries the bare number). Bands are tunable after observing the real
 * distribution once the Elo has been rebuilt.
 */
export const STRENGTH_BANDS: StrengthBand[] = [
  { min: 0, max: 1199, labelRu: "Начальный", descriptionRu: "Ещё нарабатывает базу против соперников лиги." },
  { min: 1200, max: 1399, labelRu: "Развивающийся", descriptionRu: "Конкурентен отрезками, чаще уступает более сильным." },
  { min: 1400, max: 1599, labelRu: "Средний", descriptionRu: "Держит равный уровень с основной массой игроков." },
  { min: 1600, max: 1799, labelRu: "Уверенный", descriptionRu: "Стабильно обыгрывает игроков ниже и борется с равными." },
  { min: 1800, max: 1999, labelRu: "Сильный", descriptionRu: "Превосходит большинство соперников по силе игры." },
  { min: 2000, max: 2199, labelRu: "Очень сильный", descriptionRu: "Один из сильнейших, редко проигрывает по силе." },
  { min: 2200, max: Infinity, labelRu: "Элита", descriptionRu: "Топ лиги - доминирующий игрок." },
];

export function getStrengthBand(rating?: number | null): StrengthBand | null {
  if (rating == null) return null;
  return STRENGTH_BANDS.find((b) => rating >= b.min && rating <= b.max) ?? null;
}

/** Provisional while fewer than 10 completed games (matches strength engine). */
export function strengthRatingReliability(games: number): StrengthReliabilityStatus {
  return games < 10 ? "provisional" : "established";
}

export function getStrengthReliabilityLabelRu(status?: StrengthReliabilityStatus | null): string | null {
  if (!status) return null;
  return { provisional: "Предварительный", established: "Подтверждённый" }[status];
}

export function calculateSkillIndex(params: {
  matchWinRatePct?: number | null;
  gameWinRatePct?: number | null;
  rallyWinRatePct?: number | null;
}): number | null {
  const { matchWinRatePct, gameWinRatePct, rallyWinRatePct } = params;
  if (matchWinRatePct == null || gameWinRatePct == null || rallyWinRatePct == null) return null;
  const value = matchWinRatePct * 0.3 + gameWinRatePct * 0.35 + rallyWinRatePct * 0.35;
  return Math.round(value * 10) / 10;
}

export function getSkillIndexStatus(skillIndex?: number | null): SkillIndexStatus | null {
  if (skillIndex == null) return null;
  return getSkillIndexScaleItem(skillIndex)?.status ?? null;
}

export function getSkillIndexScaleItem(skillIndex?: number | null): SkillIndexScaleItem | null {
  if (skillIndex == null) return null;
  return SKILL_INDEX_SCALE.find((row) => skillIndex >= row.min && skillIndex <= row.max) ?? null;
}

export function getSkillIndexLabelRu(status?: SkillIndexStatus | null): string | null {
  if (!status) return null;
  return SKILL_INDEX_SCALE.find((row) => row.status === status)?.labelRu ?? null;
}

export function getSkillIndexShortLabelRu(status?: SkillIndexStatus | null): string | null {
  if (!status) return null;
  return SKILL_INDEX_SCALE.find((row) => row.status === status)?.shortLabelRu ?? null;
}

type WindowStats = {
  played: number;
  won: number;
  lost: number;
  matchWR: number | null;
  gameWR: number | null;
  rallyWR: number | null;
  formIndex: number | null;
};

function windowStats(ps: MatchPerspective[]): WindowStats {
  let won = 0;
  let lost = 0;
  let gW = 0;
  let gL = 0;
  let rW = 0;
  let rL = 0;
  for (const p of ps) {
    if (p.isWin) won += 1;
    else lost += 1;
    gW += p.gamesWon;
    gL += p.gamesLost;
    rW += p.ralliesWon;
    rL += p.ralliesLost;
  }
  const matchWR = pct(won, ps.length);
  const gameWR = pct(gW, gW + gL);
  const rallyWR = pct(rW, rW + rL);
  return { played: ps.length, won, lost, matchWR, gameWR, rallyWR, formIndex: formIndexOf(matchWR, gameWR, rallyWR) };
}

/** Reliability 0..1, saturating around ~15 matches. */
function reliabilityScore(matchesPlayed: number): number | null {
  if (matchesPlayed <= 0) return null;
  return Math.min(1, matchesPlayed / 15);
}

/**
 * Reduce a player's match perspectives into the aggregate. Input must be in
 * chronological order (oldest first) for streaks/last-N/trend metrics.
 */
export function computeAggregate(perspectives: MatchPerspective[]): ComputedAggregate {
  const a: ComputedAggregate = {
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    ralliesPlayed: 0,
    ralliesWon: 0,
    ralliesLost: 0,
    firstMatchAt: null,
    lastMatchAt: null,
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
    skillIndex: null,
    skillIndexStatus: null,
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
    last5GameWinRatePct: null,
    last5RallyWinRatePct: null,
    last10MatchesPlayed: 0,
    last10MatchesWon: 0,
    last10MatchesLost: 0,
    last10MatchWinRatePct: null,
    last10GameWinRatePct: null,
    last10RallyWinRatePct: null,
    matchWinRateTrendPp: null,
    gameWinRateTrendPp: null,
    rallyWinRateTrendPp: null,
    formIndexTrend: null,
    cumulativeGameBalance: 0,
    cumulativeRallyBalance: 0,
    statsReliabilityScore: null,
  };

  for (const p of perspectives) {
    a.matchesPlayed += 1;
    if (p.isWin) a.matchesWon += 1;
    else a.matchesLost += 1;
    a.gamesWon += p.gamesWon;
    a.gamesLost += p.gamesLost;
    a.ralliesWon += p.ralliesWon;
    a.ralliesLost += p.ralliesLost;

    if (p.isWin) {
      if (p.gamesLost === 0) a.wins3_0 += 1;
      else if (p.gamesLost === 1) a.wins3_1 += 1;
      else a.wins3_2 += 1;
    } else {
      if (p.gamesWon === 2) a.losses2_3 += 1;
      else if (p.gamesWon === 1) a.losses1_3 += 1;
      else a.losses0_3 += 1;
    }

    if (p.isFiveGame) {
      a.fiveGameMatches += 1;
      if (p.isWin) a.fiveGameMatchesWon += 1;
      else a.fiveGameMatchesLost += 1;
    }
    a.fifthGameRalliesWon += p.fifthGameRalliesWon;
    a.fifthGameRalliesLost += p.fifthGameRalliesLost;

    a.closeGamesWon += p.closeGamesWon;
    a.closeGamesLost += p.closeGamesLost;
    a.overtimeGamesWon += p.overtimeGamesWon;
    a.overtimeGamesLost += p.overtimeGamesLost;
    a.dominantGamesWon += p.dominantGamesWon;
    a.heavyGamesLost += p.heavyGamesLost;

    a.totalMatchDurationSec += p.durationSec;
    if (p.durationSec > 0) {
      if (a.shortestMatchDurationSec === null || p.durationSec < a.shortestMatchDurationSec)
        a.shortestMatchDurationSec = p.durationSec;
      if (a.longestMatchDurationSec === null || p.durationSec > a.longestMatchDurationSec)
        a.longestMatchDurationSec = p.durationSec;
    }

    if (p.trailed0_2) {
      a.matchesTrailed0_2 += 1;
      if (p.reverseSweepWin) a.reverseSweepWins += 1;
      if (p.forcedFifthAfterTrailing0_2) a.forcedFifthAfterTrailing0_2 += 1;
      if (p.lostAfterTrailing0_2) a.matchesLostAfterTrailing0_2 += 1;
      a.gamesWonAfterTrailing0_2 += p.gamesWonAfterTrailing0_2;
    }
    if (p.led2_0) {
      a.matchesLed2_0 += 1;
      if (p.winAfterLeading2_0) a.winsAfterLeading2_0 += 1;
      if (p.lossAfterLeading2_0) a.lossesAfterLeading2_0 += 1;
      if (p.reverseSweepLoss) a.reverseSweepLosses += 1;
    }

    if (p.playedAt) {
      if (!a.firstMatchAt || p.playedAt < a.firstMatchAt) a.firstMatchAt = p.playedAt;
      if (!a.lastMatchAt || p.playedAt > a.lastMatchAt) a.lastMatchAt = p.playedAt;
    }
  }

  a.gamesPlayed = a.gamesWon + a.gamesLost;
  a.ralliesPlayed = a.ralliesWon + a.ralliesLost;
  a.cleanWins = a.wins3_0;
  a.cleanLosses = a.losses0_3;
  a.closeGamesPlayed = a.closeGamesWon + a.closeGamesLost;
  a.overtimeGamesPlayed = a.overtimeGamesWon + a.overtimeGamesLost;

  a.gameBalance = a.gamesWon - a.gamesLost;
  a.rallyBalance = a.ralliesWon - a.ralliesLost;
  a.gameBalancePerMatch = avg(a.gameBalance, a.matchesPlayed);
  a.rallyBalancePerMatch = avg(a.rallyBalance, a.matchesPlayed);

  a.matchWinRatePct = pct(a.matchesWon, a.matchesPlayed);
  a.gameWinRatePct = pct(a.gamesWon, a.gamesPlayed);
  a.rallyWinRatePct = pct(a.ralliesWon, a.ralliesPlayed);
  a.cleanWinRatePct = pct(a.cleanWins, a.matchesWon);
  a.cleanLossRatePct = pct(a.cleanLosses, a.matchesLost);

  a.fiveGameMatchRatePct = pct(a.fiveGameMatches, a.matchesPlayed);
  a.fiveGameWinRatePct = pct(a.fiveGameMatchesWon, a.fiveGameMatches);
  a.fifthGameRallyWinRatePct = pct(a.fifthGameRalliesWon, a.fifthGameRalliesWon + a.fifthGameRalliesLost);

  a.closeGameRatePct = pct(a.closeGamesPlayed, a.gamesPlayed);
  a.closeGameWinRatePct = pct(a.closeGamesWon, a.closeGamesPlayed);
  a.overtimeGameRatePct = pct(a.overtimeGamesPlayed, a.gamesPlayed);
  a.overtimeGameWinRatePct = pct(a.overtimeGamesWon, a.overtimeGamesPlayed);

  a.dominantGameWinRatePct = pct(a.dominantGamesWon, a.gamesWon);
  a.heavyGameLossRatePct = pct(a.heavyGamesLost, a.gamesLost);

  a.avgMatchDurationSec = avg(a.totalMatchDurationSec, a.matchesPlayed);
  a.avgGameDurationSec = avg(a.totalMatchDurationSec, a.gamesPlayed);
  a.avgSecondsPerRally = avg(a.totalMatchDurationSec, a.ralliesPlayed);
  if (a.avgMatchDurationSec !== null && a.matchesPlayed > 0) {
    const avgGamesPlayedPerMatch = a.gamesPlayed / a.matchesPlayed;
    a.matchLoadScore = (a.avgMatchDurationSec / 60) * avgGamesPlayedPerMatch / 4;
  }

  if (a.matchesPlayed > 0) {
    const mwr = a.matchWinRatePct ?? 0;
    const gwr = a.gameWinRatePct ?? 0;
    const rwr = a.rallyWinRatePct ?? 0;
    a.formIndex = mwr * 0.45 + gwr * 0.35 + rwr * 0.2;
    a.skillIndex = calculateSkillIndex({
      matchWinRatePct: a.matchWinRatePct,
      gameWinRatePct: a.gameWinRatePct,
      rallyWinRatePct: a.rallyWinRatePct,
    });
    a.skillIndexStatus = getSkillIndexStatus(a.skillIndex);
    a.matchConversionPp = mwr - gwr;
    a.gameConversionPp = gwr - rwr;
    a.resultConversionPp = mwr - rwr;
  }

  a.reverseSweepWinRatePct = pct(a.reverseSweepWins, a.matchesTrailed0_2);
  a.forcedFifthRateAfterTrailing0_2Pct = pct(a.forcedFifthAfterTrailing0_2, a.matchesTrailed0_2);
  a.avgGamesWonAfterTrailing0_2 = avg(a.gamesWonAfterTrailing0_2, a.matchesTrailed0_2);
  a.blownTwoGameLeadRatePct = pct(a.lossesAfterLeading2_0, a.matchesLed2_0);

  // per-match averages (7.5)
  a.avgGamesWonPerMatch = avg(a.gamesWon, a.matchesPlayed);
  a.avgGamesLostPerMatch = avg(a.gamesLost, a.matchesPlayed);
  a.avgGamesPlayedPerMatch = avg(a.gamesPlayed, a.matchesPlayed);
  a.avgRalliesWonPerMatch = avg(a.ralliesWon, a.matchesPlayed);
  a.avgRalliesLostPerMatch = avg(a.ralliesLost, a.matchesPlayed);
  a.avgRalliesPlayedPerMatch = avg(a.ralliesPlayed, a.matchesPlayed);
  a.avgMatchGamesWon = a.avgGamesWonPerMatch;
  a.avgMatchGamesLost = a.avgGamesLostPerMatch;
  a.avgRallyMarginPerGame = avg(a.rallyBalance, a.gamesPlayed);

  // cumulative & reliability
  a.cumulativeGameBalance = a.gameBalance;
  a.cumulativeRallyBalance = a.rallyBalance;
  a.statsReliabilityScore = reliabilityScore(a.matchesPlayed);

  // streaks, last-N and trends (require chronological order)
  const n = perspectives.length;
  let runWin = 0;
  let runLoss = 0;
  for (const p of perspectives) {
    if (p.isWin) {
      runWin += 1;
      runLoss = 0;
      if (runWin > a.longestWinStreak) a.longestWinStreak = runWin;
    } else {
      runLoss += 1;
      runWin = 0;
      if (runLoss > a.longestLossStreak) a.longestLossStreak = runLoss;
    }
  }
  if (n > 0) {
    const lastWin = perspectives[n - 1].isWin;
    let k = 0;
    for (let i = n - 1; i >= 0 && perspectives[i].isWin === lastWin; i--) k += 1;
    if (lastWin) a.currentWinStreak = k;
    else a.currentLossStreak = k;
  }

  const last5 = windowStats(perspectives.slice(-5));
  a.last5MatchesPlayed = last5.played;
  a.last5MatchesWon = last5.won;
  a.last5MatchesLost = last5.lost;
  a.last5MatchWinRatePct = last5.matchWR;
  a.last5GameWinRatePct = last5.gameWR;
  a.last5RallyWinRatePct = last5.rallyWR;

  const last10 = windowStats(perspectives.slice(-10));
  a.last10MatchesPlayed = last10.played;
  a.last10MatchesWon = last10.won;
  a.last10MatchesLost = last10.lost;
  a.last10MatchWinRatePct = last10.matchWR;
  a.last10GameWinRatePct = last10.gameWR;
  a.last10RallyWinRatePct = last10.rallyWR;

  if (n >= 2) {
    const mid = Math.floor(n / 2);
    const early = windowStats(perspectives.slice(0, mid));
    const late = windowStats(perspectives.slice(mid));
    const tp = (l: number | null, e: number | null) => (l === null || e === null ? null : l - e);
    a.matchWinRateTrendPp = tp(late.matchWR, early.matchWR);
    a.gameWinRateTrendPp = tp(late.gameWR, early.gameWR);
    a.rallyWinRateTrendPp = tp(late.rallyWR, early.rallyWR);
    a.formIndexTrend = tp(late.formIndex, early.formIndex);
  }

  return a;
}

// --- Head-to-head (Phase 3) ---

/** Reliability bucket by sample size (matches / meetings played). */
export function sampleSizeLevel(n: number): SampleSizeLevel {
  if (n >= 11) return "high";
  if (n >= 6) return "medium";
  if (n >= 3) return "low";
  return "very_low";
}

/** Recent form from perspectives already ordered most-recent-first. */
export function recentForm(perspectivesDesc: MatchPerspective[], k = 5) {
  const recent = perspectivesDesc.slice(0, k);
  return {
    results: recent.map((p): MatchResultCode => (p.isWin ? "W" : "L")),
    scores: recent.map((p) => p.matchScore),
    won: recent.filter((p) => p.isWin).length,
    lost: recent.filter((p) => !p.isWin).length,
    played: recent.length,
  };
}

export type MatchupClassification = {
  status: MatchupStatus;
  hasClosingProblem: boolean;
  hasPositiveTrend: boolean;
  isHighLoad: boolean;
};

/**
 * Interpret a head-to-head aggregate into a comfort tier + boolean flags.
 * `comfortIndex` is the H2H form index (match/game/rally WR weighted). Recent
 * results are ordered most-recent-first. Thresholds are heuristic; only the
 * numeric/enum/boolean outputs are stored — never UI label text.
 */
export function classifyMatchup(input: {
  meetings: number;
  comfortIndex: number | null;
  matchesWon: number;
  matchesLost: number;
  rallyWinRatePct: number | null;
  fiveGameWinRatePct: number | null;
  closeGameWinRatePct: number | null;
  fiveGameMatchRatePct: number | null;
  avgMatchDurationSec: number | null;
  recentResults: MatchResultCode[];
}): MatchupClassification {
  const status: MatchupStatus = (() => {
    if (input.meetings < 2 || input.comfortIndex === null) return "not_enough_data";
    const c = input.comfortIndex;
    if (c >= 65) return "very_comfortable";
    if (c >= 55) return "comfortable";
    if (c > 45) return "equal";
    if (c > 35) return "uncomfortable";
    return "very_uncomfortable";
  })();

  const hasClosingProblem =
    input.meetings >= 3 &&
    input.rallyWinRatePct !== null &&
    input.rallyWinRatePct >= 48 &&
    ((input.fiveGameWinRatePct !== null && input.fiveGameWinRatePct < 40) ||
      (input.closeGameWinRatePct !== null && input.closeGameWinRatePct < 40));

  const recent3 = input.recentResults.slice(0, 3);
  const recentWins = recent3.filter((r) => r === "W").length;
  const hasPositiveTrend =
    input.matchesLost > input.matchesWon && recent3.length >= 2 && recentWins > recent3.length - recentWins;

  const isHighLoad =
    (input.avgMatchDurationSec !== null && input.avgMatchDurationSec > 2400) ||
    (input.fiveGameMatchRatePct !== null && input.fiveGameMatchRatePct >= 40);

  return { status, hasClosingProblem, hasPositiveTrend, isHighLoad };
}
