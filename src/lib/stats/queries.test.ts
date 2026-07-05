import { describe, expect, it } from "vitest";
import type { PlayerStatsAggregateRow } from "@/lib/db/schema";
import { mapStatsRow } from "./queries";

describe("mapStatsRow", () => {
  it("exposes skillIndex and skillIndexStatus for API consumers", () => {
    const row = {
      matchWinRatePct: "65.000",
      gameWinRatePct: "58.000",
      rallyWinRatePct: "53.000",
      skillIndex: "58.400",
      skillIndexStatus: "good",
      gameBalancePerMatch: null,
      rallyBalancePerMatch: null,
      cleanWinRatePct: null,
      cleanLossRatePct: null,
    } as PlayerStatsAggregateRow;

    expect(mapStatsRow(row)).toMatchObject({
      matchWinRatePct: 65,
      gameWinRatePct: 58,
      rallyWinRatePct: 53,
      skillIndex: 58.4,
      skillIndexStatus: "good",
    });
  });
});
