import { describe, expect, it } from "vitest";
import { divisionFormat, getRatingRows, isShortFormatSeason, type League, type MockResult } from "@/lib/league";

function result(playerIdx: number, stage: number, points: number, div = 1): MockResult {
  return {
    div,
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

function league(results: MockResult[], season = "25/26"): League {
  return {
    season,
    players: [
      { idx: 1, name: "A", rankedinName: "A", rid: "R1", skill: 0, rankSkill: 0, hue: 0, color: "#000", initials: "A", divisions: [1, 2] },
    ],
    rosters: { 1: [1], 2: [1], 3: [] },
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

  it("drops the weakest stage once a division plays more than seven", () => {
    const results = Array.from({ length: 8 }, (_, i) => result(1, i + 1, i === 0 ? 10 : 100));
    const rows = getRatingRows(league(results), 1);
    // Seven best of eight: the lone 10-point stage is the one dropped.
    expect(rows[0].points).toBe(700);
  });
});

describe("division format from 26/27", () => {
  it("puts division 1 on three stages, all of them counting", () => {
    expect(divisionFormat("26/27", 1)).toEqual({
      totalStages: 3,
      ratingMaxStage: 3,
      bestStageCount: 3,
      hasFinal: false,
    });
  });

  it("leaves divisions 2 and 3 on the nine-stage format", () => {
    expect(divisionFormat("26/27", 2).totalStages).toBe(9);
    expect(divisionFormat("26/27", 3).ratingMaxStage).toBe(8);
  });

  it("leaves earlier seasons untouched", () => {
    expect(divisionFormat("25/26", 1).totalStages).toBe(9);
    expect(isShortFormatSeason("25/26")).toBe(false);
    expect(isShortFormatSeason("26/27")).toBe(true);
    expect(isShortFormatSeason("27/28")).toBe(true);
  });

  it("sums all three division-1 stages without dropping the weakest", () => {
    const rows = getRatingRows(
      league([result(1, 1, 100), result(1, 2, 90), result(1, 3, 10)], "26/27"),
      1,
    );
    expect(rows[0].points).toBe(200);
    expect(rows[0].stages).toBe(3);
  });

  it("still drops a stage for division 2 in the same season", () => {
    const results = Array.from({ length: 8 }, (_, i) => result(1, i + 1, i === 0 ? 10 : 100, 2));
    const rows = getRatingRows(league(results, "26/27"), 2);
    expect(rows[0].points).toBe(700);
  });
});
