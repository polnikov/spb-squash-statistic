import { describe, expect, it } from "vitest";
import {
  BENCHMARK_METRIC_BY_KEY,
  benchmarkBaseLabel,
  benchmarkBaseLabelDative,
  computeMetricBenchmark,
  median,
  minDenomFor,
  resolveBenchmark,
  type BenchmarkMetric,
  type BenchmarkRow,
} from "./benchmarks";

/** Aggregate row stub: only the columns the benchmark math reads. */
function row(over: Partial<BenchmarkRow> = {}): BenchmarkRow {
  return {
    matchesPlayed: 0,
    gamesPlayed: 0,
    ralliesPlayed: 0,
    fiveGameMatches: 0,
    closeGamesPlayed: 0,
    overtimeGamesPlayed: 0,
    fifthGameRalliesWon: 0,
    fifthGameRalliesLost: 0,
    matchesTrailed0_2: 0,
    matchesLed2_0: 0,
    matchWinRatePct: null,
    gameWinRatePct: null,
    rallyWinRatePct: null,
    formIndex: null,
    fiveGameWinRatePct: null,
    closeGameWinRatePct: null,
    overtimeGameWinRatePct: null,
    fifthGameRallyWinRatePct: null,
    reverseSweepWinRatePct: null,
    forcedFifthRateAfterTrailing0_2Pct: null,
    blownTwoGameLeadRatePct: null,
    ...over,
  };
}

const matchWr = BENCHMARK_METRIC_BY_KEY.get("matchWinRatePct") as BenchmarkMetric;
const comeback = BENCHMARK_METRIC_BY_KEY.get("reverseSweepWinRatePct") as BenchmarkMetric;

/** n players, all past the season bar, with the given match winrates. */
function matchWrRows(values: (number | null)[], matchesPlayed = 10): BenchmarkRow[] {
  return values.map((v) => row({ matchesPlayed, matchWinRatePct: v === null ? null : v.toFixed(3) }));
}

describe("median", () => {
  it("takes the middle value for an odd count", () => {
    expect(median([50, 10, 30])).toBe(30);
  });

  it("averages the two middle values for an even count", () => {
    expect(median([10, 20, 30, 50])).toBe(25);
  });
});

describe("computeMetricBenchmark", () => {
  it("computes the median over qualified players", () => {
    const result = computeMetricBenchmark(matchWrRows([40, 45, 50, 55, 60]), matchWr, "season");
    expect(result).toEqual({ median: 50, qualifiedPlayers: 5 });
  });

  it("drops players below the denominator bar", () => {
    const rows = [
      ...matchWrRows([40, 45, 50, 55, 60]),
      // 100% off two matches: pure noise, must not enter the sample
      ...matchWrRows([100, 100], 2),
    ];
    const result = computeMetricBenchmark(rows, matchWr, "season");
    expect(result).toEqual({ median: 50, qualifiedPlayers: 5 });
  });

  it("applies the higher bar in the career scope", () => {
    // 10 matches each: enough for a season, short of the career bar
    const rows = matchWrRows([40, 45, 50, 55, 60], 10);
    expect(computeMetricBenchmark(rows, matchWr, "season")).not.toBeNull();
    expect(computeMetricBenchmark(rows, matchWr, "career")).toBeNull();
    expect(minDenomFor(matchWr, "career")).toBeGreaterThan(minDenomFor(matchWr, "season"));
    expect(minDenomFor(matchWr, "season")).toBe(8);
  });

  it("returns null below five qualified players", () => {
    expect(computeMetricBenchmark(matchWrRows([40, 50, 60, 70]), matchWr, "season")).toBeNull();
  });

  it("ignores rows whose metric value is null", () => {
    const rows = matchWrRows([40, 45, 50, null, null]);
    expect(computeMetricBenchmark(rows, matchWr, "season")).toBeNull();
  });

  it("uses the metric's own denominator, not the match count", () => {
    // Plenty of matches, but nobody ever trailed 0:2 often enough
    const rows = Array.from({ length: 12 }, () =>
      row({ matchesPlayed: 30, matchesTrailed0_2: 2, reverseSweepWinRatePct: "50.000" }),
    );
    expect(computeMetricBenchmark(rows, comeback, "season")).toBeNull();

    const qualified = rows.map((r) => ({ ...r, matchesTrailed0_2: 3 }));
    expect(computeMetricBenchmark(qualified, comeback, "season")).toEqual({ median: 50, qualifiedPlayers: 12 });
  });
});

describe("resolveBenchmark", () => {
  /** Player past every bar, so only the base lookup decides the outcome. */
  const bigCareer = row({ matchesPlayed: 40, matchWinRatePct: "60.000" });
  const stored = { median: 50, qualifiedPlayers: 12 };

  /** Lookup that only answers for the listed scopes. */
  const lookupFor = (scopes: string[]) => (scope: string) => (scopes.includes(scope) ? stored : null);

  it("takes the picked scope when it has a median", () => {
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season_division",
      seasonId: 7,
      division: 3,
      seasonLabel: "25/26",
      row: bigCareer,
      lookup: lookupFor(["season_division", "season", "career"]),
    });
    expect(result).toMatchObject({ resolvedScope: "season_division", baseLabel: "медиана Д3", median: 50 });
  });

  it("falls back to the season when the division has no median", () => {
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season_division",
      seasonId: 7,
      division: 3,
      seasonLabel: "25/26",
      row: bigCareer,
      lookup: lookupFor(["season", "career"]),
    });
    expect(result).toMatchObject({ resolvedScope: "season", baseLabel: "медиана сезона 25/26" });
  });

  it("falls back to the league when neither division nor season has one", () => {
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season_division",
      seasonId: 7,
      division: 3,
      seasonLabel: "25/26",
      row: bigCareer,
      lookup: lookupFor(["career"]),
    });
    expect(result).toMatchObject({ resolvedScope: "career", baseLabel: "медиана лиги" });
  });

  it("returns null when nothing is found anywhere", () => {
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season_division",
      seasonId: 7,
      division: 3,
      seasonLabel: "25/26",
      row: bigCareer,
      lookup: lookupFor([]),
    });
    expect(result).toBeNull();
  });

  it("never falls back below the picked scope: career stays career", () => {
    const seen: string[] = [];
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "career",
      seasonId: null,
      division: null,
      seasonLabel: null,
      row: bigCareer,
      lookup: (scope) => {
        seen.push(scope);
        return scope === "career" ? stored : null;
      },
    });
    expect(seen).toEqual(["career"]);
    expect(result?.resolvedScope).toBe("career");
  });

  it("hides the comparison when the player's own denominator is under the picked bar", () => {
    // Own census is judged by the PICKED scope even though a wider median exists.
    const thinSeason = row({ matchesPlayed: 5, matchWinRatePct: "100.000" });
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season_division",
      seasonId: 7,
      division: 3,
      seasonLabel: "25/26",
      row: thinSeason,
      lookup: lookupFor(["season_division", "season", "career"]),
    });
    expect(result).toBeNull();
  });

  it("hides the comparison when the player's own value is null", () => {
    const noValue = row({ matchesPlayed: 40, matchWinRatePct: null });
    const result = resolveBenchmark({
      metric: matchWr,
      scope: "season",
      seasonId: 7,
      division: null,
      seasonLabel: "25/26",
      row: noValue,
      lookup: lookupFor(["season", "career"]),
    });
    expect(result).toBeNull();
  });
});

describe("benchmarkBaseLabel", () => {
  it("never calls the career median a division median", () => {
    expect(benchmarkBaseLabel("career", null)).toBe("медиана лиги");
    expect(benchmarkBaseLabel("season", null)).toBe("медиана сезона");
    expect(benchmarkBaseLabel("season_division", 2)).toBe("медиана Д2");
  });

  it("declines the head noun after «к»", () => {
    expect(benchmarkBaseLabelDative(benchmarkBaseLabel("season_division", 1))).toBe("медиане Д1");
    expect(benchmarkBaseLabelDative(benchmarkBaseLabel("career", null))).toBe("медиане лиги");
  });
});
