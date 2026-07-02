import { describe, expect, it } from "vitest";
import {
  classifyMatchup,
  computeAggregate,
  gameFlags,
  matchComebackFlags,
  pct,
  perspective,
  recentForm,
  sampleSizeLevel,
  type GamePair,
  type MatchForStats,
} from "./compute";

const m1: MatchForStats = {
  // A wins 3:0
  gamesA: 3,
  gamesB: 0,
  games: [
    { a: 11, b: 5 },
    { a: 11, b: 7 },
    { a: 11, b: 9 },
  ],
  playedAt: new Date("2026-01-10"),
};

const m2: MatchForStats = {
  // A loses 1:3
  gamesA: 1,
  gamesB: 3,
  games: [
    { a: 11, b: 8 },
    { a: 9, b: 11 },
    { a: 7, b: 11 },
    { a: 5, b: 11 },
  ],
  playedAt: new Date("2026-02-20"),
};

describe("pct", () => {
  it("returns null on zero denominator", () => {
    expect(pct(5, 0)).toBeNull();
  });
  it("computes percentage", () => {
    expect(pct(1, 2)).toBe(50);
  });
});

describe("gameFlags", () => {
  it("flags a close game (margin 2)", () => {
    const f = gameFlags(11, 9);
    expect(f).toMatchObject({ pointMargin: 2, winnerIsA: true, isCloseGame: true, isOvertimeGame: false });
  });
  it("flags overtime (max > 11)", () => {
    expect(gameFlags(12, 10)).toMatchObject({ isCloseGame: true, isOvertimeGame: true });
  });
  it("flags dominant (margin >= 5)", () => {
    expect(gameFlags(11, 5)).toMatchObject({ isDominantGame: true, isCloseGame: false });
  });
  it("not close at margin 3", () => {
    expect(gameFlags(11, 8).isCloseGame).toBe(false);
  });
});

describe("perspective", () => {
  it("projects side A of a 3:0 win", () => {
    const p = perspective(m1, true);
    expect(p).toMatchObject({
      isWin: true,
      gamesWon: 3,
      gamesLost: 0,
      ralliesWon: 33,
      ralliesLost: 21,
      matchScore: "3:0",
    });
  });
  it("projects side B of the same match as a 0:3 loss", () => {
    const p = perspective(m1, false);
    expect(p).toMatchObject({
      isWin: false,
      gamesWon: 0,
      gamesLost: 3,
      ralliesWon: 21,
      ralliesLost: 33,
      matchScore: "0:3",
    });
  });
  it("sums rallies from per-game detail (1:3 loss)", () => {
    const p = perspective(m2, true);
    expect(p.ralliesWon).toBe(32);
    expect(p.ralliesLost).toBe(41);
    expect(p.matchScore).toBe("1:3");
  });
});

describe("computeAggregate", () => {
  const a = computeAggregate([perspective(m1, true), perspective(m2, true)]);

  it("counts matches/games/rallies", () => {
    expect(a.matchesPlayed).toBe(2);
    expect(a.matchesWon).toBe(1);
    expect(a.matchesLost).toBe(1);
    expect(a.gamesWon).toBe(4);
    expect(a.gamesLost).toBe(3);
    expect(a.gamesPlayed).toBe(7);
    expect(a.ralliesWon).toBe(65);
    expect(a.ralliesLost).toBe(62);
    expect(a.ralliesPlayed).toBe(127);
  });

  it("computes win rates", () => {
    expect(a.matchWinRatePct).toBe(50);
    expect(a.gameWinRatePct).toBeCloseTo(57.142857, 4);
    expect(a.rallyWinRatePct).toBeCloseTo(51.181102, 4);
  });

  it("computes balances", () => {
    expect(a.gameBalance).toBe(1);
    expect(a.rallyBalance).toBe(3);
    expect(a.gameBalancePerMatch).toBe(0.5);
    expect(a.rallyBalancePerMatch).toBe(1.5);
  });

  it("computes best-of-5 distribution and clean rates", () => {
    expect(a.wins3_0).toBe(1);
    expect(a.wins3_1).toBe(0);
    expect(a.wins3_2).toBe(0);
    expect(a.losses1_3).toBe(1);
    expect(a.losses0_3).toBe(0);
    expect(a.cleanWins).toBe(1);
    expect(a.cleanLosses).toBe(0);
    expect(a.cleanWinRatePct).toBe(100);
    expect(a.cleanLossRatePct).toBe(0);
  });

  it("tracks first/last match dates", () => {
    expect(a.firstMatchAt).toEqual(new Date("2026-01-10"));
    expect(a.lastMatchAt).toEqual(new Date("2026-02-20"));
  });

  it("returns null rates for an empty sample", () => {
    const empty = computeAggregate([]);
    expect(empty.matchWinRatePct).toBeNull();
    expect(empty.gameWinRatePct).toBeNull();
    expect(empty.rallyWinRatePct).toBeNull();
    expect(empty.gameBalancePerMatch).toBeNull();
    expect(empty.matchesPlayed).toBe(0);
  });

  it("computes composite indexes", () => {
    // formIndex = mwr*0.45 + gwr*0.35 + rwr*0.20
    const expected = 50 * 0.45 + (4 / 7) * 100 * 0.35 + (65 / 127) * 100 * 0.2;
    expect(a.formIndex).toBeCloseTo(expected, 4);
    expect(a.matchConversionPp).toBeCloseTo(50 - (4 / 7) * 100, 4);
    expect(a.gameConversionPp).toBeCloseTo((4 / 7) * 100 - (65 / 127) * 100, 4);
    expect(a.resultConversionPp).toBeCloseTo(50 - (65 / 127) * 100, 4);
  });
});

// Phase 2 metrics: five-game, close/overtime, dominant, duration.
describe("computeAggregate — phase 2", () => {
  // win 3:2 with a 5th-game; mix of close, overtime and dominant games
  const fiveGameWin: MatchForStats = {
    gamesA: 3,
    gamesB: 2,
    durationSec: 3000,
    games: [
      { a: 11, b: 4 }, // A dominant win (margin 7)
      { a: 9, b: 11 }, // A close loss (margin 2)
      { a: 12, b: 10 }, // A close + overtime win
      { a: 6, b: 11 }, // A heavy loss (margin 5)
      { a: 11, b: 9 }, // A close win (5th game)
    ],
    playedAt: new Date("2026-03-01"),
  };
  // straight 3:0 win, no five-game, one dominant
  const sweep: MatchForStats = {
    gamesA: 3,
    gamesB: 0,
    durationSec: 1200,
    games: [
      { a: 11, b: 8 },
      { a: 11, b: 2 }, // dominant
      { a: 11, b: 9 }, // close win
    ],
    playedAt: new Date("2026-03-08"),
  };
  const a = computeAggregate([perspective(fiveGameWin, true), perspective(sweep, true)]);

  it("counts five-game matches and 5th-game rallies", () => {
    expect(a.fiveGameMatches).toBe(1);
    expect(a.fiveGameMatchesWon).toBe(1);
    expect(a.fiveGameWinRatePct).toBe(100);
    expect(a.fiveGameMatchRatePct).toBe(50);
    expect(a.fifthGameRalliesWon).toBe(11);
    expect(a.fifthGameRalliesLost).toBe(9);
    expect(a.fifthGameRallyWinRatePct).toBeCloseTo(55, 1);
  });

  it("counts close and overtime games from player view", () => {
    // close: g2(loss), g3(win), g5(win) from fiveGameWin + g3(win) from sweep
    expect(a.closeGamesWon).toBe(3);
    expect(a.closeGamesLost).toBe(1);
    expect(a.closeGamesPlayed).toBe(4);
    expect(a.overtimeGamesWon).toBe(1);
    expect(a.overtimeGamesLost).toBe(0);
    expect(a.overtimeGamesPlayed).toBe(1);
  });

  it("counts dominant wins and heavy losses", () => {
    expect(a.dominantGamesWon).toBe(2); // 11:4 and 11:2
    expect(a.heavyGamesLost).toBe(1); // 6:11
  });

  it("computes duration and load metrics", () => {
    expect(a.totalMatchDurationSec).toBe(4200);
    expect(a.avgMatchDurationSec).toBe(2100);
    expect(a.shortestMatchDurationSec).toBe(1200);
    expect(a.longestMatchDurationSec).toBe(3000);
    expect(a.avgGameDurationSec).toBeCloseTo(4200 / 8, 4); // 8 games total
    expect(a.matchLoadScore).toBeCloseTo((2100 / 60) * (8 / 2) / 4, 4);
  });
});

// Phase 3: head-to-head interpretation helpers.
describe("sampleSizeLevel", () => {
  it("buckets by count", () => {
    expect(sampleSizeLevel(1)).toBe("very_low");
    expect(sampleSizeLevel(2)).toBe("very_low");
    expect(sampleSizeLevel(3)).toBe("low");
    expect(sampleSizeLevel(6)).toBe("medium");
    expect(sampleSizeLevel(11)).toBe("high");
  });
});

describe("recentForm", () => {
  const win: MatchForStats = { gamesA: 3, gamesB: 1, games: [] };
  const loss: MatchForStats = { gamesA: 1, gamesB: 3, games: [] };
  // already most-recent-first
  const desc = [perspective(win, true), perspective(loss, true), perspective(win, true)];
  it("takes the most recent k results and scores", () => {
    const rf = recentForm(desc, 5);
    expect(rf.results).toEqual(["W", "L", "W"]);
    expect(rf.scores).toEqual(["3:1", "1:3", "3:1"]);
    expect(rf.won).toBe(2);
    expect(rf.lost).toBe(1);
  });
  it("caps at k", () => {
    expect(recentForm(desc, 2).results).toEqual(["W", "L"]);
  });
});

// Comeback metrics: 0:2 trail / 2:0 lead (best-of-5 squash). A is side `a`.
describe("comeback (0:2 / 2:0)", () => {
  const mk = (games: GamePair[]): MatchForStats => {
    let a = 0;
    let b = 0;
    for (const g of games) g.a > g.b ? (a += 1) : (b += 1);
    return { gamesA: a, gamesB: b, games };
  };
  // s1: A trailed 0:2, won 3:2 (reverse sweep)
  const s1 = mk([{ a: 9, b: 11 }, { a: 8, b: 11 }, { a: 11, b: 9 }, { a: 11, b: 7 }, { a: 11, b: 8 }]);
  // s2: A trailed 0:2, lost 0:3
  const s2 = mk([{ a: 5, b: 11 }, { a: 6, b: 11 }, { a: 4, b: 11 }]);
  // s3: A trailed 0:2, leveled 2:2, lost 2:3
  const s3 = mk([{ a: 9, b: 11 }, { a: 7, b: 11 }, { a: 11, b: 8 }, { a: 11, b: 6 }, { a: 9, b: 11 }]);
  // s4: A led 2:0, won 3:0
  const s4 = mk([{ a: 11, b: 9 }, { a: 11, b: 7 }, { a: 11, b: 8 }]);
  // s5: A led 2:0, won 3:1
  const s5 = mk([{ a: 11, b: 9 }, { a: 11, b: 7 }, { a: 8, b: 11 }, { a: 11, b: 6 }]);
  // s6: A led 2:0, lost 2:3
  const s6 = mk([{ a: 11, b: 9 }, { a: 11, b: 7 }, { a: 8, b: 11 }, { a: 6, b: 11 }, { a: 9, b: 11 }]);

  it("s1: 0:2 → win 3:2 = reverse sweep", () => {
    const p = perspective(s1, true);
    expect(p).toMatchObject({
      trailed0_2: true,
      reverseSweepWin: true,
      forcedFifthAfterTrailing0_2: true,
      lostAfterTrailing0_2: false,
      gamesWonAfterTrailing0_2: 3,
      led2_0: false,
    });
    expect(matchComebackFlags(s1.games, s1.gamesA, s1.gamesB)).toMatchObject({
      isReverseSweep: true,
      wasFifthForcedAfter0_2: true,
      reverseSweepWinnerIsA: true,
    });
  });

  it("s2: 0:2 → lose 0:3", () => {
    const p = perspective(s2, true);
    expect(p).toMatchObject({
      trailed0_2: true,
      reverseSweepWin: false,
      forcedFifthAfterTrailing0_2: false,
      lostAfterTrailing0_2: true,
      gamesWonAfterTrailing0_2: 0,
    });
  });

  it("s3: 0:2 → 2:2 → lose 2:3 (A trails; B holds, not blown)", () => {
    const a = perspective(s3, true);
    expect(a).toMatchObject({
      trailed0_2: true,
      forcedFifthAfterTrailing0_2: true,
      reverseSweepWin: false,
      lostAfterTrailing0_2: true,
      gamesWonAfterTrailing0_2: 2,
    });
    const b = perspective(s3, false);
    expect(b).toMatchObject({ led2_0: true, winAfterLeading2_0: true, reverseSweepLoss: false });
    expect(matchComebackFlags(s3.games, s3.gamesA, s3.gamesB).isReverseSweep).toBe(false);
  });

  it("s4/s5: led 2:0 → win 3:0 / 3:1", () => {
    expect(perspective(s4, true)).toMatchObject({ led2_0: true, winAfterLeading2_0: true, trailed0_2: false });
    expect(perspective(s5, true)).toMatchObject({ led2_0: true, winAfterLeading2_0: true });
  });

  it("s6: led 2:0 → lose 2:3 = blown lead / opponent reverse sweep", () => {
    const a = perspective(s6, true);
    expect(a).toMatchObject({ led2_0: true, lossAfterLeading2_0: true, reverseSweepLoss: true, trailed0_2: false });
    const b = perspective(s6, false);
    expect(b).toMatchObject({ trailed0_2: true, reverseSweepWin: true, gamesWonAfterTrailing0_2: 3 });
    expect(matchComebackFlags(s6.games, s6.gamesA, s6.gamesB)).toMatchObject({
      isReverseSweep: true,
      reverseSweepWinnerIsA: false,
    });
  });

  it("aggregate of trailing-0:2 sample", () => {
    const a = computeAggregate([perspective(s1, true), perspective(s2, true), perspective(s3, true)]);
    expect(a.matchesTrailed0_2).toBe(3);
    expect(a.reverseSweepWins).toBe(1);
    expect(a.reverseSweepWinRatePct).toBeCloseTo(33.333, 2);
    expect(a.forcedFifthAfterTrailing0_2).toBe(2);
    expect(a.matchesLostAfterTrailing0_2).toBe(2);
    expect(a.gamesWonAfterTrailing0_2).toBe(5);
    expect(a.avgGamesWonAfterTrailing0_2).toBeCloseTo(5 / 3, 4);
    expect(a.matchesLed2_0).toBe(0);
    expect(a.blownTwoGameLeadRatePct).toBeNull();
  });

  it("aggregate of leading-2:0 sample", () => {
    const a = computeAggregate([perspective(s4, true), perspective(s5, true), perspective(s6, true)]);
    expect(a.matchesLed2_0).toBe(3);
    expect(a.winsAfterLeading2_0).toBe(2);
    expect(a.lossesAfterLeading2_0).toBe(1);
    expect(a.blownTwoGameLeadRatePct).toBeCloseTo(33.333, 2);
    expect(a.reverseSweepLosses).toBe(1);
    expect(a.matchesTrailed0_2).toBe(0);
    expect(a.reverseSweepWinRatePct).toBeNull();
  });
});

// Phase 4: per-match averages, streaks, last-N, trends, reliability.
describe("aggregate phase 4 (chronological)", () => {
  const W: MatchForStats = { gamesA: 3, gamesB: 0, games: [{ a: 11, b: 5 }, { a: 11, b: 5 }, { a: 11, b: 5 }] };
  const L: MatchForStats = { gamesA: 0, gamesB: 3, games: [{ a: 5, b: 11 }, { a: 5, b: 11 }, { a: 5, b: 11 }] };
  // chronological: W, L, L, W, W
  const a = computeAggregate([W, L, L, W, W].map((m) => perspective(m, true)));

  it("computes streaks", () => {
    expect(a.longestWinStreak).toBe(2);
    expect(a.longestLossStreak).toBe(2);
    expect(a.currentWinStreak).toBe(2);
    expect(a.currentLossStreak).toBe(0);
  });

  it("computes last5 / last10 windows", () => {
    expect(a.last5MatchesPlayed).toBe(5);
    expect(a.last5MatchesWon).toBe(3);
    expect(a.last5MatchWinRatePct).toBe(60);
    expect(a.last5GameWinRatePct).toBe(60); // 9 of 15 games
    expect(a.last10MatchesPlayed).toBe(5);
  });

  it("computes trends (late half minus early half)", () => {
    // early = [W, L] -> 50%, late = [L, W, W] -> 66.667%
    expect(a.matchWinRateTrendPp).toBeCloseTo(16.667, 2);
  });

  it("computes per-match averages and reliability", () => {
    expect(a.avgGamesWonPerMatch).toBeCloseTo(1.8, 5);
    expect(a.avgGamesLostPerMatch).toBeCloseTo(1.2, 5);
    expect(a.avgGamesPlayedPerMatch).toBe(3);
    expect(a.cumulativeGameBalance).toBe(3);
    expect(a.statsReliabilityScore).toBeCloseTo(5 / 15, 4);
  });

  it("reliability saturates at 1", () => {
    const big = computeAggregate(Array.from({ length: 20 }, () => perspective(W, true)));
    expect(big.statsReliabilityScore).toBe(1);
    expect(big.currentWinStreak).toBe(20);
  });
});

describe("classifyMatchup", () => {
  it("returns not_enough_data below 2 meetings", () => {
    const c = classifyMatchup({
      meetings: 1, comfortIndex: 80, matchesWon: 1, matchesLost: 0,
      rallyWinRatePct: 60, fiveGameWinRatePct: null, closeGameWinRatePct: null,
      fiveGameMatchRatePct: null, avgMatchDurationSec: null, recentResults: ["W"],
    });
    expect(c.status).toBe("not_enough_data");
  });
  it("tiers a dominant matchup as very_comfortable", () => {
    const c = classifyMatchup({
      meetings: 5, comfortIndex: 70, matchesWon: 4, matchesLost: 1,
      rallyWinRatePct: 60, fiveGameWinRatePct: 80, closeGameWinRatePct: 70,
      fiveGameMatchRatePct: 20, avgMatchDurationSec: 1200, recentResults: ["W", "W", "W"],
    });
    expect(c.status).toBe("very_comfortable");
  });
  it("flags a closing problem when competitive but loses tight games", () => {
    const c = classifyMatchup({
      meetings: 4, comfortIndex: 47, matchesWon: 1, matchesLost: 3,
      rallyWinRatePct: 50, fiveGameWinRatePct: 0, closeGameWinRatePct: 25,
      fiveGameMatchRatePct: 50, avgMatchDurationSec: 2600, recentResults: ["L", "L", "W"],
    });
    expect(c.hasClosingProblem).toBe(true);
    expect(c.isHighLoad).toBe(true); // long matches / many five-gamers
    expect(c.status).toBe("equal");
  });
  it("flags a positive trend when recent results improve a losing record", () => {
    const c = classifyMatchup({
      meetings: 5, comfortIndex: 40, matchesWon: 2, matchesLost: 3,
      rallyWinRatePct: 45, fiveGameWinRatePct: null, closeGameWinRatePct: null,
      fiveGameMatchRatePct: null, avgMatchDurationSec: 1000, recentResults: ["W", "W", "L"],
    });
    expect(c.hasPositiveTrend).toBe(true);
  });
});
