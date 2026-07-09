import { describe, expect, it } from "vitest";
import { perspective, type MatchForStats } from "./compute";
import { calibrateCareerSkillRatingK } from "./skill-rating";

function match(win: boolean, day: number): MatchForStats {
  return {
    gamesA: win ? 3 : 0,
    gamesB: win ? 0 : 3,
    games: win
      ? [{ a: 11, b: 5 }, { a: 11, b: 6 }, { a: 11, b: 7 }]
      : [{ a: 5, b: 11 }, { a: 6, b: 11 }, { a: 7, b: 11 }],
    playedAt: new Date(`2026-01-${String(day).padStart(2, "0")}`),
  };
}

describe("calibrateCareerSkillRatingK", () => {
  it("uses default K when sample is too small and no previous K exists", () => {
    const result = calibrateCareerSkillRatingK({ inputs: [] });
    expect(result).toMatchObject({
      adaptiveK: 10,
      rawOptimalK: null,
      kSource: "default",
      calibrationPlayersCount: 0,
      calibrationMatchesCount: 0,
      weightedMse: null,
    });
  });

  it("uses previous K when sample is too small", () => {
    const result = calibrateCareerSkillRatingK({
      previousApprovedK: 14,
      inputs: [{ playerId: 1, perspectives: Array.from({ length: 4 }, (_, i) => perspective(match(true, i + 1), true)) }],
    });
    expect(result.adaptiveK).toBe(14);
    expect(result.kSource).toBe("previous");
  });

  it("calibrates empirical K on enough chronological career samples", () => {
    const inputs = Array.from({ length: 15 }, (_, playerIndex) => ({
      playerId: playerIndex + 1,
      perspectives: Array.from({ length: 10 }, (_, matchIndex) => {
        const strong = playerIndex % 3 === 0;
        const swing = matchIndex >= 7 && playerIndex % 2 === 0;
        return perspective(match(strong ? !swing : swing, matchIndex + 1), true);
      }),
    }));
    const result = calibrateCareerSkillRatingK({ previousApprovedK: 10, inputs });
    expect(result.kSource).toBe("empirical");
    expect(result.calibrationPlayersCount).toBe(15);
    expect(result.calibrationMatchesCount).toBe(150);
    expect(result.adaptiveK).toBeGreaterThanOrEqual(4);
    expect(result.adaptiveK).toBeLessThanOrEqual(24);
    expect(result.rawOptimalK).not.toBeNull();
    expect(result.weightedMse).not.toBeNull();
  });
});
