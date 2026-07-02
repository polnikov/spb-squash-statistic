import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadLeague } from "@/lib/db/league";
import { buildLeague, seasonList } from "@/lib/mock/league";

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

d("loadLeague (DB) parity with buildLeague (CSV)", () => {
  const totalMatches = (rs: { matches: number }[]) => rs.reduce((a, r) => a + r.matches, 0);
  const totalPoints = (rs: { points: number }[]) => rs.reduce((a, r) => a + r.points, 0);

  for (const season of seasonList()) {
    it(`matches the mock shape for ${season}`, async () => {
      const dbLeague = await loadLeague(season);
      const mock = buildLeague(season);

      expect(dbLeague.players.length).toBe(mock.players.length);
      expect(dbLeague.results.length).toBe(mock.results.length);
      expect(dbLeague.matches.length).toBe(mock.matches.length);
      expect(dbLeague.rosters[1].length).toBe(mock.rosters[1].length);
      expect(totalMatches(dbLeague.results)).toBe(totalMatches(mock.results));
      expect(totalPoints(dbLeague.results)).toBe(totalPoints(mock.results));
    });
  }

  it("resolves points from the configured points_table (place 1 = 100)", async () => {
    const league = await loadLeague("25/26");
    const firsts = league.results.filter((r) => r.place === 1);
    expect(firsts.length).toBeGreaterThan(0);
    for (const r of firsts) expect(r.points).toBe(100);
  });
});
