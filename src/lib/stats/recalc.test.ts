import { describe, expect, it } from "vitest";
import { buildMatchGameRows } from "./recalc";

describe("buildMatchGameRows", () => {
  const rows = buildMatchGameRows({
    id: 1,
    playerAId: 10,
    playerBId: 20,
    scoreDetail: [
      { a: 11, b: 5 }, // A dominant win
      { a: 9, b: 11 }, // B close win
      { a: 12, b: 10 }, // A close + overtime win
    ],
  });

  it("creates one row per game with sequential numbers", () => {
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.gameNumber)).toEqual([1, 2, 3]);
  });

  it("assigns winner/loser per game", () => {
    expect(rows[0]).toMatchObject({ winnerId: 10, loserId: 20, pointMargin: 6, isDominantGame: true });
    expect(rows[1]).toMatchObject({ winnerId: 20, loserId: 10, isCloseGame: true, isOvertimeGame: false });
    expect(rows[2]).toMatchObject({ winnerId: 10, loserId: 20, isCloseGame: true, isOvertimeGame: true });
  });

  it("returns nothing when score detail is absent", () => {
    expect(buildMatchGameRows({ id: 2, playerAId: 1, playerBId: 2, scoreDetail: null })).toEqual([]);
  });
});
