import { describe, expect, it } from "vitest";
import {
  STRENGTH_RATING,
  applyMatch,
  expectedScore,
  isProvisional,
  kFactor,
  marginFactor,
  scoreFactor,
  type RatingState,
  type StrengthMatch,
} from "./strength-rating";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings and symmetric", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
    expect(expectedScore(1700, 1500) + expectedScore(1500, 1700)).toBeCloseTo(1, 10);
  });

  it("uses a 400-point logistic scale", () => {
    // 400 points of gap => 10:1 odds.
    expect(expectedScore(1900, 1500)).toBeCloseTo(1 / 1.1, 10);
    expect(expectedScore(1500, 1900)).toBeCloseTo(1 / 11, 10);
  });
});

describe("kFactor", () => {
  it("steps down as the game count grows", () => {
    expect(kFactor(0)).toBe(40);
    expect(kFactor(9)).toBe(40);
    expect(kFactor(10)).toBe(24);
    expect(kFactor(49)).toBe(24);
    expect(kFactor(50)).toBe(20);
    expect(kFactor(149)).toBe(20);
    expect(kFactor(150)).toBe(16);
    expect(kFactor(999)).toBe(16);
  });
});

describe("scoreFactor", () => {
  it("rewards decisive wins by games the loser took", () => {
    expect(scoreFactor(0)).toBe(1.15);
    expect(scoreFactor(1)).toBe(1.08);
    expect(scoreFactor(2)).toBe(1.0);
  });
});

describe("marginFactor", () => {
  it("amplifies by rally margin, clamped to 1.0–1.1", () => {
    expect(marginFactor(30, 30)).toBeCloseTo(1.0, 10);
    expect(marginFactor(36, 24)).toBeCloseTo(1.1, 10); // +12 -> +0.10
    expect(marginFactor(60, 20)).toBe(1.1); // clamped
    expect(marginFactor(20, 40)).toBe(1.0); // never below 1
  });
});

describe("isProvisional", () => {
  it("is true below the provisional game threshold", () => {
    expect(isProvisional(0)).toBe(true);
    expect(isProvisional(STRENGTH_RATING.provisionalGames - 1)).toBe(true);
    expect(isProvisional(STRENGTH_RATING.provisionalGames)).toBe(false);
  });
});

describe("applyMatch", () => {
  const match: StrengthMatch = {
    matchId: 1,
    playerAId: 1,
    playerBId: 2,
    winnerIsA: true,
    loserGames: 2, // scoreFactor 1.0
    winnerRallies: 33,
    loserRallies: 31, // marginFactor 1 + 2/120
  };

  it("moves equal players symmetrically and updates games/peak", () => {
    const state = new Map<number, RatingState>();
    const res = applyMatch(state, match);
    // delta = 40 * 0.5 * 1.0 * (1 + 2/120) = 20.333 -> round
    expect(res.a).toMatchObject({ before: 1500, after: 1520, delta: 20 });
    expect(res.b).toMatchObject({ before: 1500, after: 1480, delta: -20 });
    expect(state.get(1)).toEqual({ rating: 1520, games: 1, peak: 1520 });
    expect(state.get(2)).toEqual({ rating: 1480, games: 1, peak: 1500 });
  });

  it("floors ratings at the configured minimum", () => {
    const state = new Map<number, RatingState>([
      [1, { rating: STRENGTH_RATING.base, games: 0, peak: STRENGTH_RATING.base }],
      [2, { rating: STRENGTH_RATING.min + 5, games: 0, peak: STRENGTH_RATING.min + 5 }],
    ]);
    applyMatch(state, match);
    expect(state.get(2)!.rating).toBeGreaterThanOrEqual(STRENGTH_RATING.min);
  });
});
