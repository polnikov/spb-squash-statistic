import { eq, inArray } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { playerRankedinAliases, players } from "@/lib/db/schema";

export type PlayerIdentityRow = {
  id: number;
  rankedinId: string | null;
  rankedinName: string;
  adminName: string | null;
};

export function normalizeRankedinId(value: string) {
  return value.trim();
}

export async function findPlayerByRankedinId(
  rankedinId: string,
  database: Database = defaultDb,
): Promise<PlayerIdentityRow | null> {
  const rid = normalizeRankedinId(rankedinId);
  if (!rid) return null;

  const [direct] = await database
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(players)
    .where(eq(players.rankedinId, rid))
    .limit(1);
  if (direct) return direct;

  const [alias] = await database
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(playerRankedinAliases)
    .innerJoin(players, eq(playerRankedinAliases.playerId, players.id))
    .where(eq(playerRankedinAliases.rankedinId, rid))
    .limit(1);
  return alias ?? null;
}

export async function findPlayersByRankedinIds(
  rankedinIds: string[],
  database: Database = defaultDb,
): Promise<Map<string, PlayerIdentityRow>> {
  const ids = [...new Set(rankedinIds.map(normalizeRankedinId).filter(Boolean))];
  const out = new Map<string, PlayerIdentityRow>();
  if (ids.length === 0) return out;

  const directRows = await database
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(players)
    .where(inArray(players.rankedinId, ids));
  for (const row of directRows) {
    if (row.rankedinId) out.set(row.rankedinId, row);
  }

  const missing = ids.filter((id) => !out.has(id));
  if (missing.length === 0) return out;

  const aliasRows = await database
    .select({
      aliasRankedinId: playerRankedinAliases.rankedinId,
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(playerRankedinAliases)
    .innerJoin(players, eq(playerRankedinAliases.playerId, players.id))
    .where(inArray(playerRankedinAliases.rankedinId, missing));
  for (const row of aliasRows) {
    out.set(row.aliasRankedinId, {
      id: row.id,
      rankedinId: row.rankedinId,
      rankedinName: row.rankedinName,
      adminName: row.adminName,
    });
  }

  return out;
}

export async function attachRankedinIdToPlayer(
  database: Database,
  input: {
    playerId: number;
    rankedinId: string;
    rankedinName?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rankedinId = normalizeRankedinId(input.rankedinId);
  if (!rankedinId) return { ok: false, error: "Введите RankedIn ID" };

  const [target] = await database
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
    })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1);
  if (!target) return { ok: false, error: "Игрок не найден" };

  const linked = await findPlayerByRankedinId(rankedinId, database);
  if (linked && linked.id !== target.id) {
    return { ok: false, error: "RankedIn ID уже связан с другим игроком" };
  }

  const nextRankedinName = input.rankedinName?.trim() || target.rankedinName;
  const nextName = target.adminName?.trim() || nextRankedinName;

  if (target.rankedinId && target.rankedinId !== rankedinId) {
    await database
      .insert(playerRankedinAliases)
      .values({ playerId: target.id, rankedinId: target.rankedinId })
      .onConflictDoNothing();
  }

  await database
    .delete(playerRankedinAliases)
    .where(eq(playerRankedinAliases.rankedinId, rankedinId));

  await database
    .update(players)
    .set({ rankedinId, rankedinName: nextRankedinName, name: nextName })
    .where(eq(players.id, target.id));

  return { ok: true };
}
