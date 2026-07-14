import { eq, isNotNull } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { playerAvatars, players } from "@/lib/db/schema";
import { findPlayerByRankedinId } from "@/lib/db/player-identity";
import type { PlayerAvatarMedia } from "@/lib/player-avatar-store";

/** Every stored avatar, keyed by the player's RankedIn id, for the public pages. */
export async function getPlayerAvatarsByRid(database: Database = defaultDb): Promise<Record<string, PlayerAvatarMedia>> {
  const rows = await database
    .select({
      rid: players.rankedinId,
      dataUrl: playerAvatars.dataUrl,
      fileName: playerAvatars.fileName,
      scale: playerAvatars.scale,
      offsetX: playerAvatars.offsetX,
      offsetY: playerAvatars.offsetY,
    })
    .from(playerAvatars)
    .innerJoin(players, eq(players.id, playerAvatars.playerId))
    .where(isNotNull(players.rankedinId));

  const out: Record<string, PlayerAvatarMedia> = {};
  for (const row of rows) {
    if (!row.rid) continue;
    out[row.rid] = {
      dataUrl: row.dataUrl,
      fileName: row.fileName ?? "",
      scale: row.scale,
      x: row.offsetX,
      y: row.offsetY,
    };
  }
  return out;
}

/** Upsert the avatar for the player behind a RankedIn id (aliases included). */
export async function savePlayerAvatar(
  rid: string,
  media: PlayerAvatarMedia,
  database: Database = defaultDb,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const player = await findPlayerByRankedinId(rid, database);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (!media.dataUrl) return { ok: false, error: "Пустое изображение" };

  const values = {
    playerId: player.id,
    dataUrl: media.dataUrl,
    fileName: media.fileName || null,
    scale: Math.round(media.scale),
    offsetX: Math.round(media.x),
    offsetY: Math.round(media.y),
    updatedAt: new Date(),
  };
  await database
    .insert(playerAvatars)
    .values(values)
    .onConflictDoUpdate({
      target: playerAvatars.playerId,
      set: {
        dataUrl: values.dataUrl,
        fileName: values.fileName,
        scale: values.scale,
        offsetX: values.offsetX,
        offsetY: values.offsetY,
        updatedAt: values.updatedAt,
      },
    });
  return { ok: true };
}

export async function deletePlayerAvatar(
  rid: string,
  database: Database = defaultDb,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const player = await findPlayerByRankedinId(rid, database);
  if (!player) return { ok: false, error: "Игрок не найден" };
  await database.delete(playerAvatars).where(eq(playerAvatars.playerId, player.id));
  return { ok: true };
}
