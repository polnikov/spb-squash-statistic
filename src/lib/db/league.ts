/**
 * Assembles the `League` shape the UI/query helpers expect from the Drizzle
 * tables. Server components call this; the resulting plain object is safe to
 * pass as props into client components.
 *
 * Player `idx` is a per-season array index (consistent within a single loaded
 * league); `results`/`matches` reference players by that idx, mapped from DB
 * ids. Color/hue/initials use the same deterministic formulas as the mock.
 */

import { asc, desc, eq } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { matches, players, pointsTable, results, seasons, stageDivisions, stages } from "@/lib/db/schema";
import { capitalizePlayerName } from "@/lib/format";
import { resolvePoints, type PointsRule } from "@/lib/points";
import {
  TOTAL_STAGES,
  type League,
  type MockPlayer,
  type MockResult,
  type MockStage,
  type RealMatch,
} from "@/lib/league";

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

const num = (v: string | null): number => (v === null ? 0 : Number(v));

export async function loadLeague(
  season: string,
  database: Database = defaultDb,
): Promise<League> {
  const [seasonRow] = await database.select().from(seasons).where(eq(seasons.label, season)).limit(1);
  if (!seasonRow) {
    return { season, players: [], rosters: { 1: [], 2: [], 3: [] }, stages: [], results: [], matches: [] };
  }
  const seasonId = seasonRow.id;

  // The five reads below are independent — issued as one parallel wave
  // instead of five sequential round trips.
  // configured points rules (season-agnostic; resolved per stage date+division)
  const pointsRowsQ = database
    .select({
      division: pointsTable.division,
      effectiveFrom: pointsTable.effectiveFrom,
      place: pointsTable.place,
      points: pointsTable.points,
    })
    .from(pointsTable);

  // global player lookup (id -> rid/name)
  const allPlayersQ = database
    .select({ id: players.id, rid: players.rankedinId, name: players.name })
    .from(players);

  // results joined with stage metadata, ordered for stable idx assignment
  const resRowsQ = database
    .select({
      stageNumber: stages.number,
      stageDate: stages.date,
      playerId: results.playerId,
      division: results.division,
      place: results.place,
      matches: results.matches,
      wonMatches: results.wonMatches,
      lostMatches: results.lostMatches,
      games: results.games,
      wonGames: results.wonGames,
      lostGames: results.lostGames,
      balls: results.balls,
      wonBalls: results.wonBalls,
      lostBalls: results.lostBalls,
      courtMinutes: results.courtMinutes,
      rank: results.rank,
      ratingBefore: results.ratingBefore,
      ratingAfter: results.ratingAfter,
      points: results.points,
    })
    .from(results)
    .innerJoin(stages, eq(results.stageId, stages.id))
    .where(eq(stages.seasonId, seasonId))
    .orderBy(asc(stages.number), asc(results.division), asc(results.place));

  // matches
  const matchRowsQ = database
    .select({
      stageNumber: stages.number,
      division: matches.division,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      gamesA: matches.gamesA,
      gamesB: matches.gamesB,
      winnerId: matches.winnerId,
      scoreDetail: matches.scoreDetail,
      durationMinutes: matches.durationMinutes,
      retired: matches.retired,
    })
    .from(matches)
    .innerJoin(stages, eq(matches.stageId, stages.id))
    .where(eq(stages.seasonId, seasonId))
    .orderBy(asc(stages.number), asc(matches.division));

  // stage numbers/dates (shaped into the fixed 1..9 list below)
  const stageRowsQ = database
    .select({ number: stages.number, date: stages.date })
    .from(stages)
    .where(eq(stages.seasonId, seasonId));

  const [pointsRows, allPlayers, resRows, matchRows, stageRows] = await Promise.all([
    pointsRowsQ,
    allPlayersQ,
    resRowsQ,
    matchRowsQ,
    stageRowsQ,
  ]);

  const pointsRules: PointsRule[] = pointsRows.map((r) => ({
    division: r.division,
    effectiveFrom: r.effectiveFrom,
    place: r.place,
    points: Number(r.points),
  }));

  const idToRid = new Map<number, string>();
  const idToName = new Map<number, string>();
  for (const p of allPlayers) {
    if (p.rid) idToRid.set(p.id, p.rid);
    idToName.set(p.id, p.name);
  }

  // assign per-season idx in first-appearance order
  const idToIdx = new Map<number, number>();
  const playerList: MockPlayer[] = [];
  const ensurePlayer = (playerId: number): number => {
    const existing = idToIdx.get(playerId);
    if (existing != null) return existing;
    const idx = playerList.length;
    idToIdx.set(playerId, idx);
    const rid = idToRid.get(playerId) ?? String(playerId);
    const name = capitalizePlayerName(idToName.get(playerId) ?? rid);
    const hue = hashHue(rid);
    playerList.push({
      idx,
      name,
      rankedinName: name,
      rid,
      skill: 0,
      rank: 0,
      hue,
      color: `oklch(0.63 0.17 ${hue})`,
      initials: initialsOf(name),
      divisions: [],
    });
    return idx;
  };

  const rosters: Record<number, number[]> = { 1: [], 2: [], 3: [] };
  const resultsOut: MockResult[] = [];

  for (const r of resRows) {
    const idx = ensurePlayer(r.playerId);
    const player = playerList[idx];
    if (!player.divisions.includes(r.division)) player.divisions.push(r.division);
    if (rosters[r.division] && !rosters[r.division].includes(idx)) rosters[r.division].push(idx);
    const ratingAfter = num(r.ratingAfter);
    if (ratingAfter > player.skill) {
      player.skill = ratingAfter;
      player.rank = Math.round(ratingAfter * 100);
    }
    resultsOut.push({
      div: r.division,
      stage: r.stageNumber,
      date: r.stageDate ?? "",
      playerIdx: idx,
      place: r.place,
      matches: r.matches,
      wonM: r.wonMatches,
      lostM: r.lostMatches,
      games: r.games,
      wonG: r.wonGames,
      lostG: r.lostGames,
      balls: r.balls,
      wonB: r.wonBalls,
      lostB: r.lostBalls,
      court: r.courtMinutes,
      rank: r.rank ?? Math.round(ratingAfter * 100),
      ratingBefore: num(r.ratingBefore),
      ratingAfter,
      points: resolvePoints(pointsRules, r.division, r.stageDate ?? "", r.place),
    });
  }

  for (const p of playerList) p.divisions.sort((a, b) => a - b);

  const matchesOut: RealMatch[] = [];
  for (const m of matchRows) {
    const aIdx = idToIdx.get(m.playerAId);
    const bIdx = idToIdx.get(m.playerBId);
    if (aIdx == null || bIdx == null) continue;
    const winnerIdx =
      m.winnerId != null && idToIdx.get(m.winnerId) != null
        ? idToIdx.get(m.winnerId)!
        : m.gamesA >= m.gamesB
          ? aIdx
          : bIdx;
    matchesOut.push({
      stage: m.stageNumber,
      division: m.division,
      aIdx,
      bIdx,
      gamesA: m.gamesA,
      gamesB: m.gamesB,
      winnerIdx,
      detail: m.scoreDetail ?? [],
      durationMin: m.durationMinutes ?? 0,
      retired: m.retired,
    });
  }

  // stages (fill 1..9; done = has a stored date)
  const dateByNo = new Map<number, string>();
  for (const s of stageRows) dateByNo.set(s.number, s.date ?? "");
  const stagesOut: MockStage[] = Array.from({ length: TOTAL_STAGES }, (_, i) => {
    const no = i + 1;
    const date = dateByNo.get(no) ?? "";
    return { no, date, done: Boolean(date) };
  });

  return { season, players: playerList, rosters, stages: stagesOut, results: resultsOut, matches: matchesOut };
}

/**
 * Season labels that actually have imported data (≥1 stage_division), ordered
 * by the canonical seasonList. The season dropdown uses this so a season whose
 * every stage was deleted no longer appears.
 */
export async function listSeasonsWithData(database: Database = defaultDb): Promise<string[]> {
  // Real DB seasons that have ≥1 imported stage-division, newest first.
  // Not gated by the static seed list, so admin-imported seasons appear.
  const rows = await database
    .selectDistinct({ label: seasons.label, startYear: seasons.startYear })
    .from(stageDivisions)
    .innerJoin(stages, eq(stageDivisions.stageId, stages.id))
    .innerJoin(seasons, eq(stages.seasonId, seasons.id))
    .orderBy(desc(seasons.startYear));
  return rows.map((r) => r.label);
}

/**
 * Full admin roster: every player in the DB (incl. ones without results, e.g.
 * just created), merged with the season league for rank/divisions/avatar. DB
 * name fields win so admin edits show immediately. Keyed by rankedinId, or a
 * synthetic `#<id>` when none.
 */
export async function listManagedPlayers(
  league: League,
  database: Database = defaultDb,
): Promise<MockPlayer[]> {
  const all = await database
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(players)
    .orderBy(asc(players.rankedinName));

  const byRid = new Map(league.players.map((p) => [p.rid, p]));
  return all.map((p) => {
    const rid = p.rankedinId ?? `#${p.id}`;
    const base = byRid.get(rid);
    const hue = hashHue(rid);
    return {
      idx: base?.idx ?? -p.id,
      name: p.adminName?.trim() || capitalizePlayerName(p.rankedinName),
      rankedinName: capitalizePlayerName(p.rankedinName),
      adminName: p.adminName ?? undefined,
      rid,
      skill: base?.skill ?? 0,
      rank: base?.rank ?? 0,
      hue,
      color: base?.color ?? `oklch(0.63 0.17 ${hue})`,
      initials: base?.initials ?? initialsOf(p.rankedinName),
      divisions: base?.divisions ?? [],
    } satisfies MockPlayer;
  });
}

/** Load every season's league, keyed by label — for multi-season views. */
export async function loadAllLeagues(
  database: Database = defaultDb,
): Promise<Record<string, League>> {
  const labels = await listSeasonsWithData(database);
  // Seasons are independent — load them in parallel.
  const leagues = await Promise.all(labels.map((label) => loadLeague(label, database)));
  return Object.fromEntries(labels.map((label, i) => [label, leagues[i]]));
}

/**
 * Newest season that actually has data, or null on an empty database.
 * `listSeasonsWithData` already orders newest-first.
 */
export async function getCurrentSeason(database: Database = defaultDb): Promise<string | null> {
  const [newest] = await listSeasonsWithData(database);
  return newest ?? null;
}

/**
 * The season a page should render: the requested one when it exists in the DB,
 * otherwise the newest season with data. Admin-imported seasons resolve on their
 * own, with no hardcoded list to keep in sync.
 */
export async function resolveSeason(
  requested?: string | null,
  database: Database = defaultDb,
): Promise<string> {
  const labels = await listSeasonsWithData(database);
  if (requested && labels.includes(requested)) return requested;
  return labels[0] ?? "";
}
