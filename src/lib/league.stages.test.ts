import { describe, expect, it } from "vitest";
import { getRatingRows, type League, type MockResult } from "@/lib/league";

function result(playerIdx: number, stage: number, points: number): MockResult {
  return {
    div: 1,
    stage,
    date: `2025-0${stage}-01`,
    playerIdx,
    place: 1,
    matches: 3,
    wonM: 2,
    lostM: 1,
    games: 9,
    wonG: 6,
    lostG: 3,
    balls: 100,
    wonB: 55,
    lostB: 45,
    court: 60,
    rank: 0,
    ratingBefore: 0,
    ratingAfter: 0,
    points,
  };
}

function league(results: MockResult[]): League {
  return {
    season: "25/26",
    players: [
      { idx: 1, name: "A", rankedinName: "A", rid: "R1", skill: 0, rankSkill: 0, hue: 0, color: "#000", initials: "A", divisions: [1] },
    ],
    rosters: { 1: [1], 2: [], 3: [] },
    stages: Array.from({ length: 9 }, (_, i) => ({ no: i + 1, date: "", done: true })),
    results,
    matches: [],
  };
}

describe("getRatingRows stages count", () => {
  it("counts the final (9th) stage as a played stage", () => {
    const rows = getRatingRows(league([result(1, 1, 100), result(1, 2, 90), result(1, 9, 200)]), 1);
    expect(rows[0].stages).toBe(3);
  });

  it("keeps points on the first eight stages only, ignoring the final", () => {
    const rows = getRatingRows(league([result(1, 1, 100), result(1, 2, 90), result(1, 9, 200)]), 1);
    // The 200-point final must not be part of the total; best-of first eight = 190.
    expect(rows[0].points).toBe(190);
  });
});
