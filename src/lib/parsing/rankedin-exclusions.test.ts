import { describe, expect, it } from "vitest";
import {
  applyManualPlaces,
  collectExclusions,
  type ParsedStagePlayer,
  type StageImportInput,
} from "@/lib/parsing/rankedin";

const player = (rankedinId: string, place: number, name = rankedinId): ParsedStagePlayer => ({
  tournament: "T",
  rankedinId,
  name,
  playerUrl: "",
  place,
  ratingBefore: null,
  ratingAfter: null,
  matches: 0,
  wins: 0,
  losses: 0,
  courtMinutes: 0,
  games: 0,
  wonGames: 0,
  lostGames: 0,
  balls: 0,
  wonBalls: 0,
  lostBalls: 0,
});

const ids = (rows: ParsedStagePlayer[]) => rows.map((r) => [r.rankedinId, r.place] as const);

describe("collectExclusions - fake id activation", () => {
  const rows = [player("R000000001", 1), player("F002617679", 0)];
  const noMatches: never[] = [];

  it("auto-excludes a fake id by default", () => {
    const out = collectExclusions({ tournament: "T" } as StageImportInput, rows, noMatches);
    expect(out).toEqual([{ rankedinId: "F002617679", reason: "Фейковый профиль (ID F…)" }]);
  });

  it("keeps a fake id the admin activated", () => {
    const input = { tournament: "T", includedRankedinIds: ["F002617679"] } as StageImportInput;
    const out = collectExclusions(input, rows, noMatches);
    expect(out).toEqual([]);
  });

  it("still lets a real id be excluded by hand", () => {
    const input = { tournament: "T", excludedRankedinIds: ["R000000001"] } as StageImportInput;
    const out = collectExclusions(input, rows, noMatches);
    // Fake auto-excluded + the manual one.
    expect(out.map((e) => e.rankedinId).sort()).toEqual(["F002617679", "R000000001"]);
  });
});

describe("applyManualPlaces", () => {
  it("slots a place-0 player and shifts everyone from there down", () => {
    const rows = [player("A", 1), player("B", 2), player("C", 3), player("F", 0)];
    const out = applyManualPlaces(rows, [{ rankedinId: "F", place: 2 }], new Set());
    expect(ids(out)).toEqual([
      ["A", 1],
      ["F", 2],
      ["B", 3],
      ["C", 4],
    ]);
  });

  it("applies several manual places, ascending, staying contiguous", () => {
    const rows = [player("A", 1), player("B", 2), player("F1", 0), player("F2", 0)];
    const out = applyManualPlaces(
      rows,
      [
        { rankedinId: "F2", place: 2 },
        { rankedinId: "F1", place: 1 },
      ],
      new Set(),
    );
    expect(ids(out)).toEqual([
      ["F1", 1],
      ["F2", 2],
      ["A", 3],
      ["B", 4],
    ]);
  });

  it("ignores an excluded id and a non-positive place", () => {
    const rows = [player("A", 1), player("F", 0)];
    const excluded = applyManualPlaces(rows, [{ rankedinId: "F", place: 2 }], new Set(["F"]));
    expect(ids(excluded)).toEqual([
      ["A", 1],
      ["F", 0],
    ]);
    const zero = applyManualPlaces(rows, [{ rankedinId: "F", place: 0 }], new Set());
    expect(ids(zero)).toEqual([
      ["A", 1],
      ["F", 0],
    ]);
  });
});
