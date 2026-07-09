import { describe, expect, it } from "vitest";
import type { PlayerStatsAggregateRow } from "@/lib/db/schema";
import { mapStatsRow } from "./queries";

describe("mapStatsRow", () => {
  it("exposes skillIndex, skillRating and statuses for API consumers", () => {
    const row = {
      matchWinRatePct: "65.000",
      gameWinRatePct: "58.000",
      rallyWinRatePct: "53.000",
      skillIndex: "58.400",
      skillIndexStatus: "good",
      skillRating: "54.200",
      skillRatingReliability: "0.500",
      skillRatingReliabilityStatus: "eligible",
      skillRatingLevelStatus: "competitive",
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
      careerSkillIndex: 58.4,
      skillRating: 54.2,
      skillRatingReliability: 0.5,
      skillRatingReliabilityStatus: "eligible",
      skillRatingLevelStatus: "competitive",
    });
  });
});
