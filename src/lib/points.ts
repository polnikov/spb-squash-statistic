/**
 * Placement -> points rules. The configurable `points_table` holds rule rows
 * versioned by `effective_from`; this module resolves the points for a placement
 * at a given stage date, with a hardcoded default scale as the fallback.
 */

/** Default placement->points used when no configured table applies. */
export const DEFAULT_PTS: Record<number, number> = {
  1: 100, 2: 85, 3: 72, 4: 61, 5: 52, 6: 44, 7: 37, 8: 31,
  9: 26, 10: 22, 11: 18, 12: 15, 13: 12, 14: 10,
};

export function defaultPointsFor(place: number): number {
  return DEFAULT_PTS[place] ?? Math.max(2, 10 - (place - 14));
}

/** A single configured rule row (one place within one effective table). */
export type PointsRule = {
  division: number;
  /** ISO date "YYYY-MM-DD". */
  effectiveFrom: string;
  place: number;
  points: number;
};

/**
 * Points for `place` in `division` at `stageDate`. Tables are season-agnostic:
 * among the division's rules effective by the date (effectiveFrom <= stageDate),
 * the latest table wins. Returns 0 when no table applies (deleting a table
 * zeroes the rating retroactively; adding an earlier-dated one adds points back).
 */
export function resolvePoints(
  rules: PointsRule[],
  division: number,
  stageDate: string,
  place: number,
): number {
  const applicable = rules.filter((r) => r.division === division && r.effectiveFrom <= stageDate);
  if (applicable.length === 0) return 0;

  let bestFrom = "";
  for (const r of applicable) if (r.effectiveFrom > bestFrom) bestFrom = r.effectiveFrom;

  const row = applicable.find((r) => r.effectiveFrom === bestFrom && r.place === place);
  return row ? row.points : 0;
}
