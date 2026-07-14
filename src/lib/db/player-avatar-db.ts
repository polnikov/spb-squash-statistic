import { eq, isNotNull } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { playerAvatars, players } from "@/lib/db/schema";
import { findPlayerByRankedinId } from "@/lib/db/player-identity";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  decodeDataUrl,
  type PlayerAvatarDraft,
  type PlayerAvatarMedia,
} from "@/lib/player-avatar-store";

/** Versioned URL: the query string moves on every upload, so the image behind it
 *  can be cached by the browser indefinitely. */
function avatarUrl(rid: string, updatedAt: Date) {
  return `/api/player-avatar/${encodeURIComponent(rid)}?v=${updatedAt.getTime()}`;
}

/**
 * Every stored avatar, keyed by the player's RankedIn id, for the public pages.
 * Only URLs and crops: the bytes stay out of the page payload and the browser
 * fetches them from /api/player-avatar, cached.
 */
export async function getPlayerAvatarsByRid(database: Database = defaultDb): Promise<Record<string, PlayerAvatarMedia>> {
  const rows = await database
    .select({
      rid: players.rankedinId,
      scale: playerAvatars.scale,
      offsetX: playerAvatars.offsetX,
      offsetY: playerAvatars.offsetY,
      updatedAt: playerAvatars.updatedAt,
    })
    .from(playerAvatars)
    .innerJoin(players, eq(players.id, playerAvatars.playerId))
    .where(isNotNull(players.rankedinId));

  const out: Record<string, PlayerAvatarMedia> = {};
  for (const row of rows) {
    if (!row.rid) continue;
    out[row.rid] = {
      url: avatarUrl(row.rid, row.updatedAt),
      scale: row.scale,
      x: row.offsetX,
      y: row.offsetY,
    };
  }
  return out;
}

/** The image itself, for the route that serves it. */
export async function getPlayerAvatarImage(
  rid: string,
  database: Database = defaultDb,
): Promise<{ image: Buffer; mime: string; updatedAt: Date } | null> {
  const player = await findPlayerByRankedinId(rid, database);
  if (!player) return null;

  const [row] = await database
    .select({ image: playerAvatars.image, mime: playerAvatars.mime, updatedAt: playerAvatars.updatedAt })
    .from(playerAvatars)
    .where(eq(playerAvatars.playerId, player.id))
    .limit(1);
  return row ?? null;
}

/**
 * Upsert the avatar for the player behind a RankedIn id (aliases included).
 *
 * `dataUrl` carries a freshly picked photo, already downscaled and re-encoded in
 * the browser. Without it only the crop is written, so dragging the sliders does
 * not re-upload the image.
 */
export async function savePlayerAvatar(
  rid: string,
  media: PlayerAvatarDraft,
  database: Database = defaultDb,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const player = await findPlayerByRankedinId(rid, database);
  if (!player) return { ok: false, error: "Игрок не найден" };

  const crop = {
    scale: Math.round(media.scale),
    offsetX: Math.round(media.x),
    offsetY: Math.round(media.y),
    updatedAt: new Date(),
  };

  if (!media.dataUrl) {
    const updated = await database
      .update(playerAvatars)
      .set(crop)
      .where(eq(playerAvatars.playerId, player.id))
      .returning({ playerId: playerAvatars.playerId });
    return updated.length ? { ok: true } : { ok: false, error: "Фото не загружено" };
  }

  const decoded = decodeDataUrl(media.dataUrl);
  if (!decoded) return { ok: false, error: "Некорректное изображение" };
  if (!AVATAR_MIME_TYPES.includes(decoded.mime)) {
    return { ok: false, error: `Формат не поддерживается: ${decoded.mime}` };
  }
  if (decoded.bytes.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, error: `Изображение слишком большое: ${Math.round(decoded.bytes.byteLength / 1024)} КБ` };
  }

  const values = {
    image: decoded.bytes,
    mime: decoded.mime,
    fileName: media.fileName || null,
    ...crop,
  };
  await database
    .insert(playerAvatars)
    .values({ playerId: player.id, ...values })
    .onConflictDoUpdate({ target: playerAvatars.playerId, set: values });
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
