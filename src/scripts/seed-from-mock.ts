/**
 * Seed the database from the bundled RankedIn CSV exports (the same source the
 * mock `buildLeague` uses). Idempotent: wipes the league tables and reinserts.
 *
 *   npx tsx src/scripts/seed-from-mock.ts
 *
 * After seeding, run the stats backfill:
 *   npx tsx src/scripts/backfill-stats.ts
 */

import { db } from "@/lib/db";
import {
  matchGames,
  matches,
  players,
  playerStatsAggregate,
  pointsTable,
  results,
  rosters,
  seasons,
  stageDivisions,
  stages,
} from "@/lib/db/schema";
import { buildLeague, seasonList, type League } from "@/lib/mock/league";
import { defaultPointsFor } from "@/lib/points";
import { matchComebackFlags } from "@/lib/stats/compute";

function startYearOf(label: string): number {
  const yy = Number(label.slice(0, 2));
  return 2000 + (Number.isFinite(yy) ? yy : 0);
}

async function main() {
  const seasonLabels = seasonList();
  const leagues = new Map<string, League>(seasonLabels.map((s) => [s, buildLeague(s)]));

  // Global player set, deduped by RankedIn id across seasons (keep best rating).
  const playerByRid = new Map<string, { name: string; rankedinName: string; adminName?: string; skill: number }>();
  for (const league of leagues.values()) {
    for (const p of league.players) {
      const ex = playerByRid.get(p.rid);
      if (!ex) playerByRid.set(p.rid, { name: p.name, rankedinName: p.rankedinName, adminName: p.adminName, skill: p.skill });
      else if (p.skill > ex.skill) ex.skill = p.skill;
    }
  }

  await db.transaction(async (tx) => {
    // wipe (children -> parents)
    await tx.delete(playerStatsAggregate);
    await tx.delete(matchGames);
    await tx.delete(matches);
    await tx.delete(results);
    await tx.delete(rosters);
    await tx.delete(stageDivisions);
    await tx.delete(stages);
    await tx.delete(pointsTable);
    await tx.delete(players);
    await tx.delete(seasons);

    // players
    const playerRows = [...playerByRid.entries()].map(([rid, p]) => ({
      name: p.name,
      rankedinName: p.rankedinName,
      adminName: p.adminName ?? null,
      rankedinId: rid,
    }));
    const insertedPlayers = await tx.insert(players).values(playerRows).returning({ id: players.id, rid: players.rankedinId });
    const ridToId = new Map<string, number>();
    for (const row of insertedPlayers) if (row.rid) ridToId.set(row.rid, row.id);

    for (const label of seasonLabels) {
      const league = leagues.get(label)!;
      const [season] = await tx
        .insert(seasons)
        .values({ label, startYear: startYearOf(label), isCurrent: label === league.season && label === seasonLabels[0] })
        .returning({ id: seasons.id });
      const seasonId = season.id;

      // stages (only the ones actually played -> done)
      const stageNoToId = new Map<number, number>();
      for (const st of league.stages) {
        if (!st.done) continue;
        const [row] = await tx
          .insert(stages)
          .values({ seasonId, number: st.no, date: st.date || null, status: "done" })
          .returning({ id: stages.id });
        stageNoToId.set(st.no, row.id);
      }

      // stage_divisions: distinct (stage, division) present in results
      const sdSeen = new Set<string>();
      for (const r of league.results) {
        const key = `${r.stage}:${r.div}`;
        if (sdSeen.has(key)) continue;
        sdSeen.add(key);
        const stageId = stageNoToId.get(r.stage);
        if (!stageId) continue;
        await tx.insert(stageDivisions).values({ stageId, division: r.div, parseStatus: "done", parsedAt: new Date() });
      }

      // rosters
      for (const div of [1, 2, 3] as const) {
        for (const idx of league.rosters[div] ?? []) {
          const rid = league.players[idx]?.rid;
          const playerId = rid ? ridToId.get(rid) : undefined;
          if (playerId) await tx.insert(rosters).values({ seasonId, division: div, playerId });
        }
      }

      // results
      for (const r of league.results) {
        const stageId = stageNoToId.get(r.stage);
        const rid = league.players[r.playerIdx]?.rid;
        const playerId = rid ? ridToId.get(rid) : undefined;
        if (!stageId || !playerId) continue;
        await tx.insert(results).values({
          stageId,
          division: r.div,
          playerId,
          place: r.place,
          matches: r.matches,
          wonMatches: r.wonM,
          lostMatches: r.lostM,
          games: r.games,
          wonGames: r.wonG,
          lostGames: r.lostG,
          balls: r.balls,
          wonBalls: r.wonB,
          lostBalls: r.lostB,
          courtMinutes: r.court,
          rank: r.rank,
          skill: r.ratingAfter.toFixed(1),
          ratingBefore: r.ratingBefore.toFixed(2),
          ratingAfter: r.ratingAfter.toFixed(2),
          points: r.points,
        });
      }

      // matches
      for (const m of league.matches) {
        const stageId = stageNoToId.get(m.stage);
        const aRid = league.players[m.aIdx]?.rid;
        const bRid = league.players[m.bIdx]?.rid;
        const wRid = league.players[m.winnerIdx]?.rid;
        const playerAId = aRid ? ridToId.get(aRid) : undefined;
        const playerBId = bRid ? ridToId.get(bRid) : undefined;
        const winnerId = wRid ? ridToId.get(wRid) : undefined;
        if (!stageId || !playerAId || !playerBId) continue;
        const cf = matchComebackFlags(m.detail, m.gamesA, m.gamesB);
        const rsWinnerId = cf.isReverseSweep
          ? cf.reverseSweepWinnerIsA
            ? playerAId
            : playerBId
          : null;
        const rsLoserId = cf.isReverseSweep
          ? cf.reverseSweepWinnerIsA
            ? playerBId
            : playerAId
          : null;
        await tx.insert(matches).values({
          stageId,
          division: m.division,
          playerAId,
          playerBId,
          gamesA: m.gamesA,
          gamesB: m.gamesB,
          winnerId: winnerId ?? null,
          scoreDetail: m.detail,
          durationMinutes: m.durationMin,
          retired: m.retired ?? false,
          playerATrailed0_2: cf.playerATrailed0_2,
          playerBTrailed0_2: cf.playerBTrailed0_2,
          playerALed2_0: cf.playerALed2_0,
          playerBLed2_0: cf.playerBLed2_0,
          isReverseSweep: cf.isReverseSweep,
          reverseSweepWinnerId: rsWinnerId,
          reverseSweepLoserId: rsLoserId,
          wasFifthForcedAfter0_2: cf.wasFifthForcedAfter0_2,
        });
      }
    }

    // global default points tables (season-agnostic): per division, places
    // 1..maxPlace, effective from the earliest played stage overall.
    const allResults = [...leagues.values()].flatMap((l) => l.results);
    const allDates = [...leagues.values()]
      .flatMap((l) => l.stages)
      .filter((s) => s.done && s.date)
      .map((s) => s.date)
      .sort();
    const effectiveFrom = allDates[0] ?? "2000-01-01";
    for (const div of [...new Set(allResults.map((r) => r.div))]) {
      const maxPlace = Math.max(...allResults.filter((r) => r.div === div).map((r) => r.place));
      const places = Array.from({ length: maxPlace }, (_, i) => i + 1);
      await tx.insert(pointsTable).values(
        places.map((place) => ({
          division: div,
          effectiveFrom,
          place,
          points: defaultPointsFor(place).toFixed(2),
        })),
      );
    }
  });

  const counts = {
    players: playerByRid.size,
    seasons: seasonLabels.length,
  };
  console.log(`seeded players=${counts.players} seasons=${counts.seasons}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
