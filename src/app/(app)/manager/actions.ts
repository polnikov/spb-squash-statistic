"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { players, pointsTable } from "@/lib/db/schema";
import { attachRankedinIdToPlayer, findPlayerByRankedinId } from "@/lib/db/player-identity";
import { dismissDuplicateGroup, listDuplicateGroups, mergePlayers, type DuplicateGroupView, type MergeResult } from "@/lib/db/player-merge";
import { deletePlayerAvatar, getPlayerAvatarsByRid, savePlayerAvatar } from "@/lib/db/player-avatar-db";
import type { PlayerAvatarDraft, PlayerAvatarMedia } from "@/lib/player-avatar-store";
import { login, logout, requireAdmin } from "@/lib/auth";
import {
  deleteImportedStage,
  importRankedinStage,
  listImportedStages,
  previewRankedinStageImport,
  type ImportedStage,
  type StageImportInput,
  type StageImportPreview,
  type StageImportSubTournamentSelection,
} from "@/lib/parsing/rankedin";

export type { ImportedStage, StageImportInput, StageImportPreview, StageImportSubTournamentSelection } from "@/lib/parsing/rankedin";
export type { DuplicateGroupView, DuplicatePlayer, MergeResult } from "@/lib/db/player-merge";

export type LoginState = { error?: string };

/** Form-action login. Used with useFormState in the admin login screen. */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!username.trim() || !password.trim()) return { error: "Введите логин и пароль" };
  const ok = await login(username, password);
  if (!ok) return { error: "Неверный логин или пароль" };
  revalidatePath("/manager");
  return {};
}

export async function logoutAction(): Promise<void> {
  logout();
  revalidatePath("/manager");
}

export type CreatePlayerInput = {
  name: string;
  rankedinId: string;
  linkToPlayerId?: number;
};

export type PlayerLinkOption = {
  playerId: number;
  rankedinId: string | null;
  rankedinName: string;
  name: string;
};

/** Create a manual player profile. Display name = entered name (adminName null). */
export async function createPlayerAction(
  input: CreatePlayerInput,
): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Введите имя игрока" };
  const rankedinId = input.rankedinId.trim();
  if (!rankedinId) return { ok: false, error: "Введите RankedIn ID" };

  if (input.linkToPlayerId) {
    const linked = await attachRankedinIdToPlayer(db, {
      playerId: input.linkToPlayerId,
      rankedinId,
      rankedinName: name,
    });
    if (!linked.ok) return linked;
    revalidatePath("/players");
    revalidatePath("/manager");
    return { ok: true };
  }

  try {
    await db.insert(players).values({ name, rankedinName: name, rankedinId });
  } catch {
    // unique violation on rankedinId is the only expected failure
    return { ok: false, error: "RankedIn ID уже используется" };
  }

  revalidatePath("/players");
  revalidatePath("/manager");
  return { ok: true };
}

export async function listPlayerLinkOptionsAction(): Promise<PlayerLinkOption[]> {
  requireAdmin();
  return db
    .select({
      playerId: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      name: players.name,
    })
    .from(players)
    .orderBy(asc(players.rankedinName));
}

export type UpdatePlayerInput = {
  /** Current RankedIn id, used to locate the row (it may itself be edited). */
  lookupRankedinId: string;
  adminName: string;
  rankedinId: string;
};

export async function updatePlayerAction(
  input: UpdatePlayerInput,
): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();

  const adminName = input.adminName.trim() || null;
  const rankedinId = input.rankedinId.trim();
  if (!rankedinId) return { ok: false, error: "Введите RankedIn ID" };

  const player = await findPlayerByRankedinId(input.lookupRankedinId);
  if (!player) return { ok: false, error: "Игрок не найден" };

  try {
    if (rankedinId !== player.rankedinId) {
      const linked = await attachRankedinIdToPlayer(db, {
        playerId: player.id,
        rankedinId,
      });
      if (!linked.ok) return linked;
    }
    const [fresh] = await db
      .select({ rankedinName: players.rankedinName })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1);
    const name = adminName ?? fresh?.rankedinName ?? player.rankedinName;
    await db.update(players).set({ adminName, name }).where(eq(players.id, player.id));
  } catch {
    // unique violation on rankedinId is the only expected failure
    return { ok: false, error: "RankedIn ID уже используется" };
  }

  revalidatePath("/players");
  revalidatePath("/manager");
  return { ok: true };
}

// --- points tables (strictly per division; decimals allowed) ---

export type PointsRowInput = { place: number; points: number };
export type SavePointsInput = {
  division: number;
  effectiveFrom: string;
  rows: PointsRowInput[];
  /** When editing, the previous effectiveFrom whose table this replaces. */
  replaceEffectiveFrom?: string;
};
export type PointsTableGroup = {
  division: number;
  effectiveFrom: string;
  rows: { place: number; points: number }[];
};

// Points affect ratings everywhere; revalidate the public read surfaces.
// NOT "/manager": revalidating the action's own route makes Next resolve the
// server action to `undefined` on the first call (the RSC payload replaces the
// result — the "click twice" bug). The manager UI refreshes via router.refresh().
function revalidateRatings() {
  for (const p of ["/", "/divisions", "/ironman", "/players", "/stages"]) revalidatePath(p);
}

/**
 * Create or edit one points table (division, effectiveFrom). Tables are
 * season-agnostic — a stage maps to one by its date. Editing the date passes
 * `replaceEffectiveFrom` to drop the old-dated table. Retroactive: loadLeague
 * resolves points live.
 */
export async function savePointsTableAction(
  input: SavePointsInput,
): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  if (!input.effectiveFrom) return { ok: false, error: "Укажите дату" };
  if (![1, 2, 3].includes(input.division)) return { ok: false, error: "Выберите дивизион" };

  // keep last value per place; allow decimals, drop invalid rows
  const byPlace = new Map<number, number>();
  for (const r of input.rows) {
    if (Number.isInteger(r.place) && r.place > 0 && Number.isFinite(r.points) && r.points >= 0) {
      byPlace.set(r.place, r.points);
    }
  }
  if (byPlace.size === 0) return { ok: false, error: "Добавьте хотя бы одну строку (место + очки)" };

  await db.transaction(async (tx) => {
    const base = eq(pointsTable.division, input.division);
    await tx.delete(pointsTable).where(and(base, eq(pointsTable.effectiveFrom, input.effectiveFrom)));
    if (input.replaceEffectiveFrom && input.replaceEffectiveFrom !== input.effectiveFrom) {
      await tx.delete(pointsTable).where(and(base, eq(pointsTable.effectiveFrom, input.replaceEffectiveFrom)));
    }
    await tx.insert(pointsTable).values(
      [...byPlace.entries()].map(([place, points]) => ({
        division: input.division,
        effectiveFrom: input.effectiveFrom,
        place,
        points: points.toFixed(2),
      })),
    );
  });

  revalidateRatings();
  return { ok: true };
}

/** Delete a points table entirely — ratings for affected stages drop to zero. */
export async function deletePointsTableAction(input: {
  division: number;
  effectiveFrom: string;
}): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  await db
    .delete(pointsTable)
    .where(and(eq(pointsTable.division, input.division), eq(pointsTable.effectiveFrom, input.effectiveFrom)));
  revalidateRatings();
  return { ok: true };
}

/** All points tables, grouped by (division, effectiveFrom). */
export async function listPointsTablesAction(): Promise<PointsTableGroup[]> {
  const rows = await db
    .select({
      division: pointsTable.division,
      effectiveFrom: pointsTable.effectiveFrom,
      place: pointsTable.place,
      points: pointsTable.points,
    })
    .from(pointsTable)
    .orderBy(asc(pointsTable.division), asc(pointsTable.effectiveFrom), asc(pointsTable.place));

  const groups = new Map<string, PointsTableGroup>();
  for (const r of rows) {
    const key = `${r.division}|${r.effectiveFrom}`;
    const g = groups.get(key) ?? { division: r.division, effectiveFrom: r.effectiveFrom, rows: [] };
    g.rows.push({ place: r.place, points: Number(r.points) });
    groups.set(key, g);
  }
  return [...groups.values()];
}

// --- stage import from RankedIn ---

export async function previewStageImportAction(
  input: StageImportInput,
): Promise<
  | { ok: true; kind: "preview"; preview: StageImportPreview }
  | { ok: true; kind: "subtournaments"; subtournaments: StageImportSubTournamentSelection }
  | { ok: false; error: string }
> {
  requireAdmin();
  try {
    const result = await previewRankedinStageImport(input);
    if (result.kind === "subtournaments") {
      return { ok: true, kind: "subtournaments", subtournaments: result.subtournaments };
    }
    return { ok: true, kind: "preview", preview: result.preview };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ошибка парсинга турнира" };
  }
}

export async function importStageAction(
  input: StageImportInput,
): Promise<{ ok: true; players: number; matches: number; season: string; division: number; stage: number } | { ok: false; error: string }> {
  requireAdmin();
  try {
    const res = await importRankedinStage(input);
    if (!res.ok) return res;
    revalidateRatings();
    return {
      ok: true,
      players: res.players,
      matches: res.matches,
      season: res.season,
      division: res.division,
      stage: res.stage,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ошибка загрузки этапа" };
  }
}

// --- duplicate players ---

export async function listDuplicateGroupsAction(): Promise<DuplicateGroupView[]> {
  requireAdmin();
  return listDuplicateGroups();
}

/**
 * Fold duplicate rows into one player. The survivor defaults to the id with the
 * newest stage result; the rest hand over their matches and results and their
 * RankedIn ids stay as aliases. Everything derived is rebuilt afterwards, so this
 * takes as long as a full backfill.
 */
export async function mergePlayersAction(input: {
  playerIds: number[];
  survivorId?: number;
}): Promise<MergeResult> {
  requireAdmin();
  try {
    const res = await mergePlayers(input);
    if (res.ok) revalidateRatings();
    return res;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось объединить игроков" };
  }
}

/** Mark a wrongly-detected group as different people so it stops being flagged. */
export async function dismissDuplicateGroupAction(input: {
  playerIds: number[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  requireAdmin();
  try {
    const res = await dismissDuplicateGroup(input.playerIds);
    return res.ok ? { ok: true } : res;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось отклонить" };
  }
}

// --- player avatars ---

export async function listPlayerAvatarsAction(): Promise<Record<string, PlayerAvatarMedia>> {
  requireAdmin();
  return getPlayerAvatarsByRid();
}

export async function savePlayerAvatarAction(input: {
  rid: string;
  media: PlayerAvatarDraft;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  requireAdmin();
  try {
    const res = await savePlayerAvatar(input.rid, input.media);
    if (res.ok) {
      revalidatePath("/players");
      revalidatePath(`/players/${input.rid}`);
    }
    return res;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось сохранить фото" };
  }
}

export async function deletePlayerAvatarAction(input: {
  rid: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  requireAdmin();
  try {
    const res = await deletePlayerAvatar(input.rid);
    if (res.ok) {
      revalidatePath("/players");
      revalidatePath(`/players/${input.rid}`);
    }
    return res;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось удалить фото" };
  }
}

export async function listImportedStagesAction(): Promise<ImportedStage[]> {
  return listImportedStages();
}

export async function deleteImportedStageAction(input: {
  season: string;
  division: number;
  stage: number;
}): Promise<{ ok: boolean; error?: string }> {
  requireAdmin();
  try {
    const res = await deleteImportedStage(input.season, input.division, input.stage);
    if (res.ok) revalidateRatings();
    return res;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Ошибка удаления этапа" };
  }
}
