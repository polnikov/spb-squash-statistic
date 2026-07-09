import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { matchGames, matches, playerStatsAggregate } from "@/lib/db/schema";
import { loadLeague } from "@/lib/db/league";
import {
  SKILL_RATING_CONFIG,
  calculateCareerSkillRating,
  calculateSkillIndex,
  getSkillIndexStatus,
  getSkillRatingLevelStatus,
  getSkillRatingReliabilityStatus,
} from "@/lib/stats/compute";
import {
  getPlayerCareerStats,
  getPlayerIdByRid,
  getPlayerMatchups,
  getPlayerSeries,
  getStageStats,
  type PlayerStats,
} from "@/lib/stats/queries";
import { recalcPlayer, recalcStageDivision } from "@/lib/stats/recalc";

let dbUp = false;
try {
  await db.execute(sql`select 1`);
  dbUp = true;
} catch {
  dbUp = false;
}
const d = dbUp ? describe : describe.skip;

/** First league player who has a career aggregate with matches. */
async function findPlayerWithStats(): Promise<{ id: number; career: PlayerStats } | null> {
  const league = await loadLeague("25/26");
  for (const p of league.players) {
    const id = await getPlayerIdByRid(p.rid);
    if (!id) continue;
    const career = await getPlayerCareerStats(id);
    if (career && career.matchesPlayed > 0) return { id, career };
  }
  return null;
}

const ROLLBACK = Symbol("rollback");

d("stats queries (DB)", () => {
  it("getPlayerCareerStats returns a coherent career row", async () => {
    const found = await findPlayerWithStats();
    expect(found).not.toBeNull();
    const c = found!.career;
    expect(c.matchesPlayed).toBe(c.matchesWon + c.matchesLost);
    expect(c.gamesPlayed).toBe(c.gamesWon + c.gamesLost);
    expect(c.matchWinRatePct).not.toBeNull();
    expect(c.matchWinRatePct!).toBeGreaterThanOrEqual(0);
    expect(c.matchWinRatePct!).toBeLessThanOrEqual(100);
  });

  it("getPlayerMatchups returns rows keyed by opponent rid", async () => {
    const found = await findPlayerWithStats();
    const matchups = await getPlayerMatchups(found!.id);
    expect(matchups.length).toBeGreaterThan(0);
    for (const m of matchups) {
      expect(m.opponentRid).toBeTruthy();
      expect(m.meetingsPlayed).toBeGreaterThan(0);
      if (m.matchupComfortIndex !== null) expect(typeof m.matchupComfortIndex).toBe("number");
    }
  });

  it("getStageStats returns rows for a stage", async () => {
    const [row] = await db
      .select({ stageId: playerStatsAggregate.stageId })
      .from(playerStatsAggregate)
      .where(eq(playerStatsAggregate.scope, "stage"))
      .limit(1);
    expect(row?.stageId).toBeTruthy();
    const stats = await getStageStats(row!.stageId!);
    expect(stats.length).toBeGreaterThan(0);
  });

  it("getPlayerSeries returns an ordered formIndex series", async () => {
    // a season aggregate row gives a player+season known to have a series
    const [row] = await db
      .select({ playerId: playerStatsAggregate.playerId, seasonId: playerStatsAggregate.seasonId })
      .from(playerStatsAggregate)
      .where(eq(playerStatsAggregate.scope, "season"))
      .limit(1);
    expect(row?.seasonId).toBeTruthy();
    const series = await getPlayerSeries(row!.playerId, "formIndex", row!.seasonId!);
    expect(series.length).toBeGreaterThan(0);
    const order = series.map((p) => p.orderIndex);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const p of series) expect(typeof p.value).toBe("number");
  });
});

d("recalc (DB, transactional rollback)", () => {
  it("recalcPlayer rebuilds a consistent career aggregate", async () => {
    const found = await findPlayerWithStats();
    const id = found!.id;
    let career: typeof playerStatsAggregate.$inferSelect | undefined;
    try {
      await db.transaction(async (tx) => {
        await recalcPlayer(id, tx);
        [career] = await tx
          .select()
          .from(playerStatsAggregate)
          .where(and(eq(playerStatsAggregate.playerId, id), eq(playerStatsAggregate.scope, "career")));
        throw ROLLBACK;
      });
    } catch (e) {
      if (e !== ROLLBACK) throw e;
    }
    expect(career).toBeDefined();
    expect(career!.matchesPlayed).toBe(career!.matchesWon + career!.matchesLost);
    expect(career!.matchesPlayed).toBeGreaterThan(0);
    expect(career!.gamesPlayed).toBe(career!.gamesWon + career!.gamesLost);
    const expectedSkill = calculateSkillIndex({
      matchWinRatePct: career!.matchWinRatePct === null ? null : Number(career!.matchWinRatePct),
      gameWinRatePct: career!.gameWinRatePct === null ? null : Number(career!.gameWinRatePct),
      rallyWinRatePct: career!.rallyWinRatePct === null ? null : Number(career!.rallyWinRatePct),
    });
    expect(career!.skillIndex === null ? null : Number(career!.skillIndex)).toBe(expectedSkill);
    expect(career!.skillIndexStatus).toBe(getSkillIndexStatus(expectedSkill));
    const expectedRating = calculateCareerSkillRating({
      careerSkillIndex: expectedSkill,
      careerMatchesPlayed: career!.matchesPlayed,
      adaptiveK: career!.skillRatingK ?? SKILL_RATING_CONFIG.defaultAdaptiveK,
    });
    expect(career!.skillRating === null ? null : Number(career!.skillRating)).toBe(expectedRating.skillRating);
    expect(career!.skillRatingReliability === null ? null : Number(career!.skillRatingReliability)).toBe(expectedRating.reliability);
    expect(career!.skillRatingReliabilityStatus).toBe(getSkillRatingReliabilityStatus(career!.matchesPlayed));
    expect(career!.skillRatingLevelStatus).toBe(getSkillRatingLevelStatus(expectedRating.skillRating));
  });

  it("recalcStageDivision regenerates match_games", async () => {
    const [m] = await db
      .select({ stageId: matches.stageId, division: matches.division })
      .from(matches)
      .limit(1);
    expect(m).toBeDefined();
    let gameCount = 0;
    try {
      await db.transaction(async (tx) => {
        await recalcStageDivision(m.stageId, m.division, tx);
        const [row] = await tx
          .select({ c: sql<number>`count(*)::int` })
          .from(matchGames)
          .innerJoin(matches, eq(matchGames.matchId, matches.id))
          .where(and(eq(matches.stageId, m.stageId), eq(matches.division, m.division)));
        gameCount = row.c;
        throw ROLLBACK;
      });
    } catch (e) {
      if (e !== ROLLBACK) throw e;
    }
    expect(gameCount).toBeGreaterThan(0);
  });
});
