import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import {
  matchGames,
  matches,
  playerRankedinAliases,
  players,
  results,
  rosters,
  stages,
} from "@/lib/db/schema";
import { groupDuplicateCandidates, type DuplicateMatchKind } from "@/lib/players/duplicates";
import { backfillAll } from "@/lib/stats/recalc";

export type DuplicatePlayer = {
  id: number;
  name: string;
  rankedinId: string | null;
  rankedinName: string;
  adminName: string | null;
  aliases: string[];
  matches: number;
  /** Date of the newest stage the player has a result in (null if he has none). */
  lastStageDate: string | null;
  firstStageDate: string | null;
  seasons: string[];
  createdAt: string;
};

export type DuplicateGroupView = {
  key: string;
  kind: DuplicateMatchKind;
  /** Members newest-first: the head is the one a merge would keep. */
  members: DuplicatePlayer[];
};

/**
 * Activity of a player, used both to show a group and to order it in time.
 * `lastStageDate` is what decides which id is the current one: a player who came
 * back under a new RankedIn id has his newest results on that id.
 */
async function loadPlayerActivity(database: Database): Promise<Map<number, Omit<DuplicatePlayer, "id" | "name" | "rankedinId" | "rankedinName" | "adminName" | "aliases">>> {
  const rows = await database
    .select({
      playerId: results.playerId,
      matches: sql<number>`coalesce(sum(${results.matches}), 0)::int`,
      firstStageDate: sql<string | null>`min(${stages.date})::text`,
      lastStageDate: sql<string | null>`max(${stages.date})::text`,
    })
    .from(results)
    .innerJoin(stages, eq(stages.id, results.stageId))
    .groupBy(results.playerId);

  const seasonRows = await database
    .select({ playerId: rosters.playerId, seasonId: rosters.seasonId })
    .from(rosters);
  const seasonsByPlayer = new Map<number, Set<number>>();
  for (const row of seasonRows) {
    const set = seasonsByPlayer.get(row.playerId) ?? new Set<number>();
    set.add(row.seasonId);
    seasonsByPlayer.set(row.playerId, set);
  }

  const out = new Map<number, Omit<DuplicatePlayer, "id" | "name" | "rankedinId" | "rankedinName" | "adminName" | "aliases">>();
  for (const row of rows) {
    out.set(row.playerId, {
      matches: row.matches,
      firstStageDate: row.firstStageDate,
      lastStageDate: row.lastStageDate,
      seasons: [...(seasonsByPlayer.get(row.playerId) ?? [])].map(String),
      createdAt: "",
    });
  }
  return out;
}

/** Newest activity first; a player with no results at all sorts last. */
function byRecency(a: DuplicatePlayer, b: DuplicatePlayer) {
  const dateA = a.lastStageDate ?? "";
  const dateB = b.lastStageDate ?? "";
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
  return b.id - a.id;
}

export async function listDuplicateGroups(database: Database = defaultDb): Promise<DuplicateGroupView[]> {
  const rows = await database
    .select({
      id: players.id,
      name: players.name,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
      createdAt: players.createdAt,
    })
    .from(players);

  const aliasRows = await database
    .select({ playerId: playerRankedinAliases.playerId, rankedinId: playerRankedinAliases.rankedinId })
    .from(playerRankedinAliases);
  const aliasesByPlayer = new Map<number, string[]>();
  for (const row of aliasRows) {
    aliasesByPlayer.set(row.playerId, [...(aliasesByPlayer.get(row.playerId) ?? []), row.rankedinId]);
  }

  const activity = await loadPlayerActivity(database);
  const enriched: DuplicatePlayer[] = rows.map((row) => {
    const stats = activity.get(row.id);
    return {
      id: row.id,
      name: row.name,
      rankedinId: row.rankedinId,
      rankedinName: row.rankedinName,
      adminName: row.adminName,
      aliases: aliasesByPlayer.get(row.id) ?? [],
      matches: stats?.matches ?? 0,
      firstStageDate: stats?.firstStageDate ?? null,
      lastStageDate: stats?.lastStageDate ?? null,
      seasons: stats?.seasons ?? [],
      createdAt: row.createdAt.toISOString(),
    };
  });

  return groupDuplicateCandidates(enriched).map((group) => ({
    key: group.key,
    kind: group.kind,
    members: [...group.members].sort(byRecency),
  }));
}

export type MergeResult =
  | { ok: true; survivorId: number; survivorRankedinId: string | null; mergedIds: number[]; movedMatches: number; movedResults: number }
  | { ok: false; error: string };

/**
 * Fold duplicate player rows into one.
 *
 * The survivor is the row with the newest stage result, i.e. the id the player
 * currently competes under; the others hand over their raw rows (matches, results,
 * roster entries) and their RankedIn ids become aliases, so a future import that
 * still carries an old id resolves to the surviving player.
 *
 * Derived tables are not touched here: `backfillAll` rebuilds match_games, the
 * aggregates and the global Elo afterwards, and merging changes the head-to-head
 * of the opponents too.
 */
export async function mergePlayers(
  input: { playerIds: number[]; survivorId?: number },
  database: Database = defaultDb,
): Promise<MergeResult> {
  const ids = [...new Set(input.playerIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length < 2) return { ok: false, error: "Выберите минимум двух игроков" };

  const groups = await listDuplicateGroups(database);
  const known = new Map(groups.flatMap((g) => g.members).map((m) => [m.id, m]));
  const members = ids.map((id) => known.get(id)).filter((m): m is DuplicatePlayer => Boolean(m));
  if (members.length !== ids.length) {
    // Not in a duplicate group: the caller is merging rows the detector did not
    // pair, so re-read them straight from the table rather than refuse.
    const rows = await database
      .select({
        id: players.id,
        name: players.name,
        rankedinId: players.rankedinId,
        rankedinName: players.rankedinName,
        adminName: players.adminName,
        createdAt: players.createdAt,
      })
      .from(players)
      .where(inArray(players.id, ids));
    if (rows.length !== ids.length) return { ok: false, error: "Игрок не найден" };
    const activity = await loadPlayerActivity(database);
    members.length = 0;
    for (const row of rows) {
      const stats = activity.get(row.id);
      members.push({
        id: row.id,
        name: row.name,
        rankedinId: row.rankedinId,
        rankedinName: row.rankedinName,
        adminName: row.adminName,
        aliases: [],
        matches: stats?.matches ?? 0,
        firstStageDate: stats?.firstStageDate ?? null,
        lastStageDate: stats?.lastStageDate ?? null,
        seasons: stats?.seasons ?? [],
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  const ordered = [...members].sort(byRecency);
  const survivor = input.survivorId
    ? ordered.find((m) => m.id === input.survivorId)
    : ordered[0];
  if (!survivor) return { ok: false, error: "Игрок для слияния не найден" };
  const losers = ordered.filter((m) => m.id !== survivor.id);
  if (!losers.length) return { ok: false, error: "Нечего объединять" };

  const conflict = await findMergeConflict(survivor.id, losers.map((l) => l.id), database);
  if (conflict) return { ok: false, error: conflict };

  const loserIds = losers.map((l) => l.id);
  let movedMatches = 0;
  let movedResults = 0;

  await database.transaction(async (tx) => {
    const moveA = await tx
      .update(matches)
      .set({ playerAId: survivor.id })
      .where(inArray(matches.playerAId, loserIds))
      .returning({ id: matches.id });
    const moveB = await tx
      .update(matches)
      .set({ playerBId: survivor.id })
      .where(inArray(matches.playerBId, loserIds))
      .returning({ id: matches.id });
    movedMatches = new Set([...moveA, ...moveB].map((m) => m.id)).size;

    await tx.update(matches).set({ winnerId: survivor.id }).where(inArray(matches.winnerId, loserIds));
    await tx
      .update(matches)
      .set({ reverseSweepWinnerId: survivor.id })
      .where(inArray(matches.reverseSweepWinnerId, loserIds));
    await tx
      .update(matches)
      .set({ reverseSweepLoserId: survivor.id })
      .where(inArray(matches.reverseSweepLoserId, loserIds));

    const movedResultRows = await tx
      .update(results)
      .set({ playerId: survivor.id })
      .where(inArray(results.playerId, loserIds))
      .returning({ id: results.id });
    movedResults = movedResultRows.length;

    // Roster rows are unique per (season, division, player): drop the ones that
    // would collide with the survivor's own entry, move the rest.
    await tx.delete(rosters).where(
      and(
        inArray(rosters.playerId, loserIds),
        sql`exists (select 1 from ${rosters} as keep where keep.player_id = ${survivor.id} and keep.season_id = ${rosters.seasonId} and keep.division = ${rosters.division})`,
      ),
    );
    await tx.update(rosters).set({ playerId: survivor.id }).where(inArray(rosters.playerId, loserIds));

    // Every id the losers were known under keeps resolving to the survivor.
    await tx
      .update(playerRankedinAliases)
      .set({ playerId: survivor.id })
      .where(inArray(playerRankedinAliases.playerId, loserIds));
    const aliasValues = losers
      .map((l) => l.rankedinId)
      .filter((rid): rid is string => Boolean(rid) && rid !== survivor.rankedinId)
      .map((rankedinId) => ({ playerId: survivor.id, rankedinId }));
    if (aliasValues.length) {
      await tx.insert(playerRankedinAliases).values(aliasValues).onConflictDoNothing();
    }
    // The survivor's own id must not sit in the alias table as well.
    if (survivor.rankedinId) {
      await tx.delete(playerRankedinAliases).where(eq(playerRankedinAliases.rankedinId, survivor.rankedinId));
    }

    // match_games.winner_id / loser_id have no ON DELETE CASCADE, so a loser's
    // game rows would block the delete. They are derived from `matches` and
    // `backfillAll` rebuilds every one of them below, so drop them here.
    await tx
      .delete(matchGames)
      .where(
        or(
          inArray(matchGames.playerAId, loserIds),
          inArray(matchGames.playerBId, loserIds),
          inArray(matchGames.winnerId, loserIds),
          inArray(matchGames.loserId, loserIds),
        ),
      );

    // The losers hold no rows of their own any more; derived rows go with them.
    await tx.delete(players).where(inArray(players.id, loserIds));

    const keepName = survivor.adminName?.trim() || survivor.rankedinName;
    await tx.update(players).set({ name: keepName }).where(eq(players.id, survivor.id));
  });

  await backfillAll(database);

  return {
    ok: true,
    survivorId: survivor.id,
    survivorRankedinId: survivor.rankedinId,
    mergedIds: loserIds,
    movedMatches,
    movedResults,
  };
}

/**
 * Reject a merge that would corrupt the data instead of cleaning it.
 *
 * Two rows holding a result in the same stage and division are two people who
 * played that stage side by side, not one person imported twice; the same goes for
 * a match with both of them on court.
 */
async function findMergeConflict(
  survivorId: number,
  loserIds: number[],
  database: Database,
): Promise<string | null> {
  const ids = [survivorId, ...loserIds];

  const clashingResults = await database
    .select({
      stageId: results.stageId,
      division: results.division,
      n: sql<number>`count(*)::int`,
    })
    .from(results)
    .where(inArray(results.playerId, ids))
    .groupBy(results.stageId, results.division)
    .having(sql`count(*) > 1`);
  if (clashingResults.length) {
    const [first] = clashingResults;
    return `Игроки играли один и тот же этап (stage ${first.stageId}, дивизион ${first.division}) - это разные люди, слияние отменено`;
  }

  const [headToHead] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(matches)
    .where(
      and(
        inArray(matches.playerAId, ids),
        inArray(matches.playerBId, ids),
        ne(matches.playerAId, matches.playerBId),
      ),
    );
  if ((headToHead?.n ?? 0) > 0) {
    return "Между этими игроками есть личные матчи - это разные люди, слияние отменено";
  }

  return null;
}
