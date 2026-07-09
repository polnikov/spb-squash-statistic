import {
  SKILL_BASELINE,
  SKILL_RATING_CONFIG,
  calculateCareerSkillRating,
  calculateSkillIndex,
  computeAggregate,
  type MatchPerspective,
  type SkillRatingKSource,
} from "./compute";

export type CareerSkillCalibrationInput = {
  playerId: number;
  perspectives: MatchPerspective[];
};

export type CareerSkillCalibrationResult = {
  adaptiveK: number;
  rawOptimalK: number | null;
  kSource: SkillRatingKSource;
  calibrationPlayersCount: number;
  calibrationMatchesCount: number;
  weightedMse: number | null;
};

type CalibrationPair = {
  trainSkillIndex: number;
  trainMatchesPlayed: number;
  holdoutSkillIndex: number;
  holdoutMatchesPlayed: number;
};

function byPlayedAt(a: MatchPerspective, b: MatchPerspective) {
  return (a.playedAt?.getTime() ?? 0) - (b.playedAt?.getTime() ?? 0);
}

function skillIndexOf(list: MatchPerspective[]) {
  const aggregate = computeAggregate(list);
  const skillIndex = calculateSkillIndex({
    matchWinRatePct: aggregate.matchWinRatePct,
    gameWinRatePct: aggregate.gameWinRatePct,
    rallyWinRatePct: aggregate.rallyWinRatePct,
  });
  return { skillIndex, matchesPlayed: aggregate.matchesPlayed };
}

function buildCalibrationPairs(inputs: CareerSkillCalibrationInput[]): CalibrationPair[] {
  const pairs: CalibrationPair[] = [];
  for (const input of inputs) {
    const sorted = [...input.perspectives].sort(byPlayedAt);
    if (sorted.length < SKILL_RATING_CONFIG.minCalibrationMatches) continue;
    const split = Math.floor(sorted.length * 0.7);
    const train = sorted.slice(0, split);
    const holdout = sorted.slice(split);
    if (!train.length || !holdout.length) continue;
    const trainStats = skillIndexOf(train);
    const holdoutStats = skillIndexOf(holdout);
    if (trainStats.skillIndex === null || holdoutStats.skillIndex === null) continue;
    pairs.push({
      trainSkillIndex: trainStats.skillIndex,
      trainMatchesPlayed: trainStats.matchesPlayed,
      holdoutSkillIndex: holdoutStats.skillIndex,
      holdoutMatchesPlayed: holdoutStats.matchesPlayed,
    });
  }
  return pairs;
}

function scoreCandidate(pairs: CalibrationPair[], k: number): number {
  let weightedError = 0;
  let weightSum = 0;
  for (const pair of pairs) {
    const predicted = calculateCareerSkillRating({
      careerSkillIndex: pair.trainSkillIndex,
      careerMatchesPlayed: pair.trainMatchesPlayed,
      adaptiveK: k,
      baseline: SKILL_BASELINE,
    }).skillRating;
    if (predicted === null) continue;
    const weight = Math.min(pair.holdoutMatchesPlayed, 10);
    weightedError += (predicted - pair.holdoutSkillIndex) ** 2 * weight;
    weightSum += weight;
  }
  return weightSum ? weightedError / weightSum : Number.POSITIVE_INFINITY;
}

export function calibrateCareerSkillRatingK(params: {
  inputs: CareerSkillCalibrationInput[];
  previousApprovedK?: number | null;
}): CareerSkillCalibrationResult {
  const eligibleInputs = params.inputs.filter((input) => input.perspectives.length >= SKILL_RATING_CONFIG.minCalibrationMatches);
  const calibrationMatchesCount = eligibleInputs.reduce((sum, input) => sum + input.perspectives.length, 0);
  const previous = params.previousApprovedK ?? null;
  if (
    eligibleInputs.length < SKILL_RATING_CONFIG.minCalibrationPlayers ||
    calibrationMatchesCount < SKILL_RATING_CONFIG.minCalibrationTotalMatches
  ) {
    return {
      adaptiveK: previous ?? SKILL_RATING_CONFIG.defaultAdaptiveK,
      rawOptimalK: null,
      kSource: previous === null ? "default" : "previous",
      calibrationPlayersCount: eligibleInputs.length,
      calibrationMatchesCount,
      weightedMse: null,
    };
  }

  const pairs = buildCalibrationPairs(eligibleInputs);
  if (!pairs.length) {
    return {
      adaptiveK: previous ?? SKILL_RATING_CONFIG.defaultAdaptiveK,
      rawOptimalK: null,
      kSource: previous === null ? "default" : "previous",
      calibrationPlayersCount: 0,
      calibrationMatchesCount,
      weightedMse: null,
    };
  }

  let rawOptimalK: number = SKILL_RATING_CONFIG.kCandidates[0]!;
  let bestScore = scoreCandidate(pairs, rawOptimalK);
  for (const k of SKILL_RATING_CONFIG.kCandidates.slice(1)) {
    const score = scoreCandidate(pairs, k);
    if (score + SKILL_RATING_CONFIG.kScoreEpsilon < bestScore) {
      rawOptimalK = k;
      bestScore = score;
    }
  }

  const smoothed = previous === null
    ? rawOptimalK
    : previous * SKILL_RATING_CONFIG.kSmoothingAlpha + rawOptimalK * (1 - SKILL_RATING_CONFIG.kSmoothingAlpha);
  const adaptiveK = Math.max(
    SKILL_RATING_CONFIG.minAdaptiveK,
    Math.min(SKILL_RATING_CONFIG.maxAdaptiveK, Math.round(smoothed)),
  );

  return {
    adaptiveK,
    rawOptimalK,
    kSource: "empirical",
    calibrationPlayersCount: pairs.length,
    calibrationMatchesCount,
    weightedMse: bestScore,
  };
}
