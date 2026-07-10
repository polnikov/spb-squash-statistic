import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getCurrentSeason, listSeasonsWithData, loadLeague, resolveSeason } from "@/lib/db/league";
import { TOTAL_STAGES, seasonStart } from "@/lib/league";

// These hit the real database (DATABASE_URL / local bbr). Skipped when the DB
// is unreachable so the unit suite still runs without one.
let dbUp = false;
try {
  await db.execute(sql`select 1`);
  dbUp = true;
} catch {
  dbUp = false;
}

const d = dbUp ? describe : describe.skip;
const seasons = dbUp ? await listSeasonsWithData() : [];

d("loadLeague assembles a self-consistent league from the DB", () => {
  it("finds at least one season with data", () => {
    expect(seasons.length).toBeGreaterThan(0);
  });

  for (const season of seasons) {
    describe(season, () => {
      it("loads players, results and matches", async () => {
        const league = await loadLeague(season);
        expect(league.season).toBe(season);
        expect(league.players.length).toBeGreaterThan(0);
        expect(league.results.length).toBeGreaterThan(0);
      });

      it("keeps every result inside a real stage and pointing at a real player", async () => {
        const league = await loadLeague(season);
        for (const r of league.results) {
          expect(r.stage).toBeGreaterThanOrEqual(1);
          expect(r.stage).toBeLessThanOrEqual(TOTAL_STAGES);
          expect(league.players[r.playerIdx]).toBeDefined();
          expect(r.div).toBeGreaterThanOrEqual(1);
        }
      });

      it("balances each result's won/lost tallies against its totals", async () => {
        const league = await loadLeague(season);
        for (const r of league.results) {
          expect(r.wonM + r.lostM).toBe(r.matches);
          expect(r.wonG + r.lostG).toBe(r.games);
          expect(r.wonB + r.lostB).toBe(r.balls);
        }
      });

      it("gives every player a distinct place within a stage and division", async () => {
        const league = await loadLeague(season);
        const seen = new Map<string, Set<number>>();
        for (const r of league.results) {
          const key = `s${r.stage}d${r.div}`;
          const places = seen.get(key) ?? new Set<number>();
          expect(places.has(r.place)).toBe(false);
          places.add(r.place);
          seen.set(key, places);
        }
      });

      it("points every match at two distinct players and a winner among them", async () => {
        const league = await loadLeague(season);
        for (const m of league.matches) {
          expect(m.aIdx).not.toBe(m.bIdx);
          expect(league.players[m.aIdx]).toBeDefined();
          expect(league.players[m.bIdx]).toBeDefined();
          expect([m.aIdx, m.bIdx]).toContain(m.winnerIdx);
        }
      });

      it("fills stages 1..TOTAL_STAGES and dates every played one", async () => {
        const league = await loadLeague(season);
        expect(league.stages).toHaveLength(TOTAL_STAGES);
        expect(league.stages.map((s) => s.no)).toEqual(
          Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1),
        );
        for (const s of league.stages) expect(s.done).toBe(Boolean(s.date));

        const playedStages = new Set(league.results.map((r) => r.stage));
        for (const no of playedStages) expect(league.stages[no - 1].done).toBe(true);
      });
    });
  }

  it("returns an empty league for a season the DB does not know", async () => {
    const league = await loadLeague("00/01");
    expect(league.players).toEqual([]);
    expect(league.results).toEqual([]);
    expect(league.matches).toEqual([]);
  });

  it("resolves points from the configured points_table (place 1 = 100)", async () => {
    const season = await getCurrentSeason();
    expect(season).not.toBeNull();
    const league = await loadLeague(season!);
    const firsts = league.results.filter((r) => r.place === 1);
    expect(firsts.length).toBeGreaterThan(0);
    for (const r of firsts) expect(r.points).toBe(100);
  });
});

d("season resolution reads the DB, not a hardcoded list", () => {
  it("treats the newest season with data as current", async () => {
    const newest = [...seasons].sort((a, b) => seasonStart(b) - seasonStart(a))[0];
    expect(await getCurrentSeason()).toBe(newest);
    expect(seasons[0]).toBe(newest);
  });

  it("honours a requested season that exists", async () => {
    for (const season of seasons) expect(await resolveSeason(season)).toBe(season);
  });

  it("falls back to the current season for unknown or missing requests", async () => {
    const current = await getCurrentSeason();
    expect(await resolveSeason(undefined)).toBe(current);
    expect(await resolveSeason(null)).toBe(current);
    expect(await resolveSeason("99/00")).toBe(current);
    expect(await resolveSeason("garbage")).toBe(current);
  });
});
