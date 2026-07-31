/**
 * League median benchmarks: the narrow list of metrics that get a "median of
 * the league" reference value, plus the pure math behind it (qualification
 * filter + median). No I/O here - recalc.ts reads rows, calls this, writes.
 *
 * This is a comparison, not a rating: the median only shows where the typical
 * value sits, it never labels a player.
 */

import type { PlayerStatsAggregateRow } from "@/lib/db/schema";

/** How the profile shows the benchmark next to the player's own value. */
export type BenchmarkRender = "tick" | "delta";

/** Scopes benchmarks are computed for (stage scopes are too small to matter). */
export type BenchmarkScope = "career" | "season" | "season_division";

/**
 * Columns the benchmark math reads. A full aggregate row is assignable to it,
 * so the pure core stays testable without building a 100-column fixture.
 */
export type BenchmarkRow = Pick<
  PlayerStatsAggregateRow,
  | "matchesPlayed"
  | "gamesPlayed"
  | "ralliesPlayed"
  | "fiveGameMatches"
  | "closeGamesPlayed"
  | "overtimeGamesPlayed"
  | "fifthGameRalliesWon"
  | "fifthGameRalliesLost"
  | "matchesTrailed0_2"
  | "matchesLed2_0"
  | "matchWinRatePct"
  | "gameWinRatePct"
  | "rallyWinRatePct"
  | "formIndex"
  | "fiveGameWinRatePct"
  | "closeGameWinRatePct"
  | "overtimeGameWinRatePct"
  | "fifthGameRallyWinRatePct"
  | "reverseSweepWinRatePct"
  | "forcedFifthRateAfterTrailing0_2Pct"
  | "blownTwoGameLeadRatePct"
>;

export type BenchmarkMetric = {
  key: string;
  /** How many relevant events the player has - the significance base of THIS metric. */
  denom: (a: BenchmarkRow) => number;
  /** Minimum denominator to enter the median sample (season / season_division). */
  minDenom: number;
  /** Same for the career scope: a five-season horizon needs a higher bar. */
  minDenomCareer: number;
  render: BenchmarkRender;
};

/** Below this many qualified players the median is noise - no row is written. */
export const MIN_QUALIFIED_PLAYERS = 5;

/**
 * Bars checked against the real base (363 players, 5 seasons): every career
 * metric keeps 109-197 qualified players, every season and season-division
 * group fills all eleven metrics.
 */
export const BENCHMARK_METRICS: BenchmarkMetric[] = [
  { key: "matchWinRatePct", denom: (a) => a.matchesPlayed, minDenom: 8, minDenomCareer: 25, render: "delta" },
  { key: "gameWinRatePct", denom: (a) => a.gamesPlayed, minDenom: 24, minDenomCareer: 75, render: "delta" },
  { key: "rallyWinRatePct", denom: (a) => a.ralliesPlayed, minDenom: 300, minDenomCareer: 900, render: "delta" },
  { key: "formIndex", denom: (a) => a.matchesPlayed, minDenom: 8, minDenomCareer: 25, render: "tick" },
  { key: "fiveGameWinRatePct", denom: (a) => a.fiveGameMatches, minDenom: 4, minDenomCareer: 10, render: "delta" },
  { key: "closeGameWinRatePct", denom: (a) => a.closeGamesPlayed, minDenom: 6, minDenomCareer: 15, render: "delta" },
  { key: "overtimeGameWinRatePct", denom: (a) => a.overtimeGamesPlayed, minDenom: 4, minDenomCareer: 10, render: "delta" },
  {
    key: "fifthGameRallyWinRatePct",
    denom: (a) => a.fifthGameRalliesWon + a.fifthGameRalliesLost,
    minDenom: 20,
    minDenomCareer: 50,
    render: "delta",
  },
  { key: "reverseSweepWinRatePct", denom: (a) => a.matchesTrailed0_2, minDenom: 3, minDenomCareer: 8, render: "tick" },
  {
    key: "forcedFifthRateAfterTrailing0_2Pct",
    denom: (a) => a.matchesTrailed0_2,
    minDenom: 3,
    minDenomCareer: 8,
    render: "tick",
  },
  { key: "blownTwoGameLeadRatePct", denom: (a) => a.matchesLed2_0, minDenom: 3, minDenomCareer: 8, render: "tick" },
];

export const BENCHMARK_METRIC_BY_KEY = new Map(BENCHMARK_METRICS.map((m) => [m.key, m]));

/** Metric value off an aggregate row; numeric columns arrive as strings. */
export function benchmarkValue(row: BenchmarkRow, key: string): number | null {
  const raw = (row as Record<string, unknown>)[key];
  if (raw === null || raw === undefined) return null;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Qualification bar for a metric in a scope: career has the higher one. */
export function minDenomFor(metric: BenchmarkMetric, scope: BenchmarkScope): number {
  return scope === "career" ? metric.minDenomCareer : metric.minDenom;
}

/** Whether the player's own sample is big enough for the comparison to mean anything. */
export function qualifies(row: BenchmarkRow, metric: BenchmarkMetric, scope: BenchmarkScope): boolean {
  return metric.denom(row) >= minDenomFor(metric, scope);
}

/**
 * Median, not mean: a division holds 11-14 players and one dominant player
 * drags the mean away; the median shrugs it off. Even count -> average of the
 * two middle values.
 */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * League median of one metric over one group of aggregate rows (one scope,
 * one season, one division). Returns null when the qualified sample is too
 * small - the caller then writes nothing and drops any stale row.
 */
export function computeMetricBenchmark(
  rows: BenchmarkRow[],
  metric: BenchmarkMetric,
  scope: BenchmarkScope,
): { median: number; qualifiedPlayers: number } | null {
  const values: number[] = [];
  for (const row of rows) {
    if (!qualifies(row, metric, scope)) continue;
    const value = benchmarkValue(row, metric.key);
    if (value === null) continue;
    values.push(value);
  }
  if (values.length < MIN_QUALIFIED_PLAYERS) return null;
  return { median: median(values), qualifiedPlayers: values.length };
}

/**
 * Label of the comparison base, by scope, in the nominative case ("медиана
 * сезона 25/26"). Career mixes divisions, so it can never be called a division
 * median. Built from the scope the median actually came from, never from the
 * one the user picked - otherwise a fallback would be a lie.
 */
export function benchmarkBaseLabel(
  scope: BenchmarkScope,
  division: number | null,
  seasonLabel: string | null = null,
): string {
  if (scope === "career") return "медиана лиги";
  if (scope === "season") return `медиана сезона ${seasonLabel ?? ""}`.trim();
  return `медиана Д${division ?? ""}`.trim();
}

/** Generalisation order of the fallback: the picked scope first, then wider. */
const SCOPE_CASCADE: Record<BenchmarkScope, BenchmarkScope[]> = {
  season_division: ["season_division", "season", "career"],
  season: ["season", "career"],
  career: ["career"],
};

/** One stored median, as the resolver gets it from the caller's index. */
export type StoredBenchmark = { median: number; qualifiedPlayers: number };

/** Looks a median up by the exact group key. Returns null/undefined when absent. */
export type BenchmarkLookup = (
  scope: BenchmarkScope,
  seasonId: number | null,
  division: number | null,
) => StoredBenchmark | null | undefined;

export type ResolvedBenchmark = StoredBenchmark & {
  render: BenchmarkRender;
  /** Scope the median came from - may be wider than the picked one. */
  resolvedScope: BenchmarkScope;
  /** Ready caption of the base, always matching `resolvedScope`. */
  baseLabel: string;
};

/**
 * Median to show next to a player's own value in the picked scope.
 *
 * Two independent gates:
 * - the player's own denominator is judged by the PICKED scope (that census
 *   answers "is the player's own number meaningful");
 * - the median itself may come from a wider scope through the cascade
 *   season_division -> season -> career (that answers "is there a base at
 *   all"). A small division may hold fewer than five qualified players, and an
 *   element that vanishes when switching tabs reads as breakage.
 */
export function resolveBenchmark(params: {
  metric: BenchmarkMetric;
  scope: BenchmarkScope;
  seasonId: number | null;
  division: number | null;
  seasonLabel: string | null;
  row: BenchmarkRow;
  lookup: BenchmarkLookup;
}): ResolvedBenchmark | null {
  const { metric, scope, seasonId, division, seasonLabel, row, lookup } = params;
  if (!qualifies(row, metric, scope)) return null;
  if (benchmarkValue(row, metric.key) === null) return null;

  for (const candidate of SCOPE_CASCADE[scope]) {
    const found = lookup(
      candidate,
      candidate === "career" ? null : seasonId,
      candidate === "season_division" ? division : null,
    );
    if (!found) continue;
    return {
      ...found,
      render: metric.render,
      resolvedScope: candidate,
      baseLabel: benchmarkBaseLabel(candidate, division, seasonLabel),
    };
  }
  return null;
}

/**
 * Same label after "к": "+4.8 к медиане Д1". Only the head noun declines.
 * Plain prefix check, not a regex: `\b` in JS is ASCII-only and does not fire
 * between Cyrillic letters and spaces.
 */
export function benchmarkBaseLabelDative(label: string): string {
  const head = "медиана";
  return label.startsWith(head) ? `медиане${label.slice(head.length)}` : label;
}
