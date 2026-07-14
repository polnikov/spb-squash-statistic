import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  matches,
  players,
  results,
  rosters,
  seasons,
  stageDivisions,
  stages,
} from "@/lib/db/schema";
import { attachRankedinIdToPlayer, findPlayersByRankedinIds } from "@/lib/db/player-identity";
import { isFakeRankedinId } from "@/lib/rankedin-id";
import { matchComebackFlags } from "@/lib/stats/compute";
import { recalcPlayer, recalcStageDivision } from "@/lib/stats/recalc";

const API_BASE_URL = "https://api.rankedin.com/v1";
const SITE_BASE_URL = "https://www.rankedin.com";

type AnyRecord = Record<string, unknown>;

export type StageImportInput = {
  tournament: string;
  classId?: string;
  season?: string;
  division?: number;
  stage?: number;
  date?: string;
  playerLinks?: { rankedinId: string; playerId: number }[];
  /** RankedIn ids to drop from the import (fake accounts). Their matches are not
   * aggregated at all, so opponents' stats and the places are recomputed as if
   * the player had never entered the stage. */
  excludedRankedinIds?: string[];
};

export type ParsedStagePlayer = {
  tournament: string;
  rankedinId: string;
  name: string;
  playerUrl: string;
  place: number;
  rankedinPlace?: number;
  resultClassId?: string;
  resultClassName?: string;
  ratingBefore: number | null;
  ratingAfter: number | null;
  matches: number;
  wins: number;
  losses: number;
  courtMinutes: number;
  games: number;
  wonGames: number;
  lostGames: number;
  balls: number;
  wonBalls: number;
  lostBalls: number;
};

export type ParsedStageMatch = {
  tournament: string;
  date: string;
  category: string;
  draw: string;
  court: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  winnerName: string;
  winnerRankedinId: string;
  gamesA: number;
  gamesB: number;
  scoreDetail: { a: number; b: number }[];
  durationMinutes: number;
  retired: boolean;
};

export type PlayerImportStatus = "matched" | "new" | "conflict";

export type StageImportPlayerPreview = ParsedStagePlayer & {
  status: PlayerImportStatus;
  existingPlayerId?: number;
  existingRankedinId?: string | null;
  existingRankedinName?: string;
  possibleMatches?: {
    playerId: number;
    rankedinId: string | null;
    rankedinName: string;
    name: string;
  }[];
  conflictReason?: string;
  excludedFromImport?: boolean;
  excludeReason?: string;
};

export type StageImportPreview = {
  tournamentId: string;
  tournamentName: string;
  tournamentUrl: string;
  resultsPageUrl: string;
  matchesPageUrl: string;
  selectedSubTournament: RankedInSubTournamentOption | null;
  season: string;
  division: number;
  stage: number;
  date: string;
  players: StageImportPlayerPreview[];
  matches: ParsedStageMatch[];
  warnings: string[];
  conflicts: number;
  /** true when this season+division+stage already has imported data. */
  alreadyImported: boolean;
};

export type RankedInSubTournamentOption = {
  id: string;
  name: string;
};

export type StageImportSubTournamentSelection = {
  tournamentId: string;
  tournamentName: string;
  tournamentUrl: string;
  resultsPageUrl: string;
  matchesPageUrl: string;
  options: RankedInSubTournamentOption[];
};

export type StageImportPreviewResult =
  | { kind: "preview"; preview: StageImportPreview }
  | { kind: "subtournaments"; subtournaments: StageImportSubTournamentSelection };

type InternalPlayerStats = ParsedStagePlayer & {
  wins: number;
  losses: number;
  courtMinutes: number;
  wonGames: number;
  lostGames: number;
  wonBalls: number;
  lostBalls: number;
  tournamentClass: string;
};

type ParsedStageData = Omit<StageImportPreview, "players" | "conflicts" | "alreadyImported"> & {
  players: ParsedStagePlayer[];
  exclusions: StageImportExclusion[];
};

type ParseRankedinTournamentResult =
  | { kind: "preview"; parsed: ParsedStageData }
  | { kind: "subtournaments"; subtournaments: StageImportSubTournamentSelection };

export async function previewRankedinStageImport(input: StageImportInput): Promise<StageImportPreviewResult> {
  const parsed = await parseRankedinTournament(input);
  if (parsed.kind === "subtournaments") {
    return parsed;
  }

  const { exclusions, ...parsedStage } = parsed.parsed;
  const statuses = await classifyPlayers(parsedStage.players);
  const reasonById = new Map(exclusions.map((e) => [e.rankedinId, e.reason]));
  const playersPreview = parsedStage.players.map((p) => ({
    ...p,
    ...(statuses.get(p.rankedinId) ?? { status: "new" as const }),
    ...(reasonById.has(p.rankedinId)
      ? {
          excludedFromImport: true,
          excludeReason: reasonById.get(p.rankedinId),
        }
      : {}),
  }));
  return {
    kind: "preview",
    preview: {
      ...parsedStage,
      players: playersPreview,
      conflicts: playersPreview.filter((p) => !p.excludedFromImport && p.status === "conflict").length,
      alreadyImported: await isStageImported(parsedStage.season, parsedStage.division, parsedStage.stage),
    },
  };
}

/** Whether a season+division+stage already has results in the DB. */
async function isStageImported(season: string, division: number, stage: number): Promise<boolean> {
  const [s] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.label, season)).limit(1);
  if (!s) return false;
  const [st] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.seasonId, s.id), eq(stages.number, stage)))
    .limit(1);
  if (!st) return false;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(results)
    .where(and(eq(results.stageId, st.id), eq(results.division, division)));
  return (row?.n ?? 0) > 0;
}

export type ImportedStage = {
  season: string;
  division: number;
  stage: number;
  date: string | null;
  players: number;
  matches: number;
};

/** All imported stage-divisions with row counts, for the admin list. */
export async function listImportedStages(): Promise<ImportedStage[]> {
  const sds = await db
    .select({
      stageId: stageDivisions.stageId,
      division: stageDivisions.division,
      season: seasons.label,
      stage: stages.number,
      date: stages.date,
    })
    .from(stageDivisions)
    .innerJoin(stages, eq(stageDivisions.stageId, stages.id))
    .innerJoin(seasons, eq(stages.seasonId, seasons.id));

  const resCounts = await db
    .select({ stageId: results.stageId, division: results.division, n: sql<number>`count(*)::int` })
    .from(results)
    .groupBy(results.stageId, results.division);
  const matchCounts = await db
    .select({ stageId: matches.stageId, division: matches.division, n: sql<number>`count(*)::int` })
    .from(matches)
    .groupBy(matches.stageId, matches.division);
  const resBy = new Map(resCounts.map((r) => [`${r.stageId}:${r.division}`, r.n]));
  const matchBy = new Map(matchCounts.map((r) => [`${r.stageId}:${r.division}`, r.n]));

  return sds
    .map((sd) => ({
      season: sd.season,
      division: sd.division,
      stage: sd.stage,
      date: sd.date,
      players: resBy.get(`${sd.stageId}:${sd.division}`) ?? 0,
      matches: matchBy.get(`${sd.stageId}:${sd.division}`) ?? 0,
    }))
    .sort((a, b) => a.season.localeCompare(b.season) || a.division - b.division || a.stage - b.stage);
}

/** Delete an imported stage-division and recompute affected players. */
export async function deleteImportedStage(
  season: string,
  division: number,
  stage: number,
): Promise<{ ok: boolean; error?: string }> {
  const [s] = await db.select({ id: seasons.id }).from(seasons).where(eq(seasons.label, season)).limit(1);
  if (!s) return { ok: false, error: "Сезон не найден" };
  const [st] = await db
    .select({ id: stages.id })
    .from(stages)
    .where(and(eq(stages.seasonId, s.id), eq(stages.number, stage)))
    .limit(1);
  if (!st) return { ok: false, error: "Этап не найден" };
  const stageId = st.id;

  const resPlayers = await db
    .select({ id: results.playerId })
    .from(results)
    .where(and(eq(results.stageId, stageId), eq(results.division, division)));
  const matchPlayers = await db
    .select({ a: matches.playerAId, b: matches.playerBId })
    .from(matches)
    .where(and(eq(matches.stageId, stageId), eq(matches.division, division)));
  const affected = new Set<number>();
  for (const r of resPlayers) affected.add(r.id);
  for (const m of matchPlayers) {
    affected.add(m.a);
    affected.add(m.b);
  }

  await db.transaction(async (tx) => {
    await tx.delete(matches).where(and(eq(matches.stageId, stageId), eq(matches.division, division)));
    await tx.delete(results).where(and(eq(results.stageId, stageId), eq(results.division, division)));
    await tx.delete(stageDivisions).where(and(eq(stageDivisions.stageId, stageId), eq(stageDivisions.division, division)));
  });

  for (const playerId of affected) await recalcPlayer(playerId);
  return { ok: true };
}

export async function importRankedinStage(input: StageImportInput): Promise<{
  ok: true;
  tournamentId: string;
  players: number;
  matches: number;
  season: string;
  division: number;
  stage: number;
} | {
  ok: false;
  error: string;
}> {
  const previewResult = await previewRankedinStageImport(input);
  if (previewResult.kind === "subtournaments") {
    return { ok: false, error: "Выберите подтурнир перед загрузкой этапа" };
  }
  const preview = previewResult.preview;
  if (preview.conflicts > 0) {
    return { ok: false, error: `Есть конфликты ID: ${preview.conflicts}` };
  }
  if (preview.alreadyImported) {
    return {
      ok: false,
      error: `Этап ${preview.stage} (дивизион ${preview.division}, ${preview.season}) уже загружен. Удалите его в списке, чтобы перезагрузить.`,
    };
  }

  const startYear = startYearOf(preview.season);
  const stageDate = preview.date || null;

  const result = await db.transaction(async (tx) => {
    const [existingSeason] = await tx
      .select({ id: seasons.id })
      .from(seasons)
      .where(eq(seasons.label, preview.season))
      .limit(1);
    const seasonId = existingSeason
      ? existingSeason.id
      : (await tx
          .insert(seasons)
          .values({ label: preview.season, startYear, isCurrent: false })
          .returning({ id: seasons.id }))[0].id;

    const [existingStage] = await tx
      .select({ id: stages.id })
      .from(stages)
      .where(and(eq(stages.seasonId, seasonId), eq(stages.number, preview.stage)))
      .limit(1);
    const stageId = existingStage
      ? existingStage.id
      : (await tx
          .insert(stages)
          .values({ seasonId, number: preview.stage, date: stageDate, status: "done" })
          .returning({ id: stages.id }))[0].id;

    if (existingStage) {
      await tx
        .update(stages)
        .set({ date: stageDate, status: "done" })
        .where(eq(stages.id, stageId));
    }

    const importPlayers = preview.players.filter((p) => !p.excludedFromImport);
    const excludedIds = new Set(preview.players.filter((p) => p.excludedFromImport).map((p) => p.rankedinId));
    const importMatches = preview.matches.filter((m) => !excludedIds.has(m.playerAId) && !excludedIds.has(m.playerBId));
    const rankedinIds = importPlayers.map((p) => p.rankedinId).filter(Boolean);
    const playerLinks = new Map((input.playerLinks ?? []).map((link) => [link.rankedinId.trim(), link.playerId]));
    const existingByRankedinId = await findPlayersByRankedinIds(rankedinIds, tx);

    const ridToDbId = new Map<string, number>();

    for (const p of importPlayers) {
      const linkedPlayerId = playerLinks.get(p.rankedinId);
      if (linkedPlayerId) {
        const linked = await attachRankedinIdToPlayer(tx, {
          playerId: linkedPlayerId,
          rankedinId: p.rankedinId,
          rankedinName: p.name,
        });
        if (!linked.ok) throw new Error(linked.error);
        ridToDbId.set(p.rankedinId, linkedPlayerId);
        continue;
      }

      const existing = existingByRankedinId.get(p.rankedinId);
      if (existing) {
        if (existing.rankedinId === p.rankedinId) {
          const name = existing.adminName?.trim() || p.name;
          await tx
            .update(players)
            .set({ rankedinName: p.name, name })
            .where(eq(players.id, existing.id));
        }
        ridToDbId.set(p.rankedinId, existing.id);
        continue;
      }

      const [inserted] = await tx
        .insert(players)
        .values({ name: p.name, rankedinName: p.name, rankedinId: p.rankedinId })
        .returning({ id: players.id });
      ridToDbId.set(p.rankedinId, inserted.id);
    }

    const [existingStageDivision] = await tx
      .select({ id: stageDivisions.id })
      .from(stageDivisions)
      .where(and(eq(stageDivisions.stageId, stageId), eq(stageDivisions.division, preview.division)))
      .limit(1);

    if (existingStageDivision) {
      await tx
        .update(stageDivisions)
        .set({
          rankedinTournamentId: preview.tournamentId,
          rankedinClassId: preview.selectedSubTournament?.id ?? null,
          parseStatus: "done",
          parsedAt: new Date(),
          error: null,
        })
        .where(eq(stageDivisions.id, existingStageDivision.id));
    } else {
      await tx.insert(stageDivisions).values({
        stageId,
        division: preview.division,
        rankedinTournamentId: preview.tournamentId,
        rankedinClassId: preview.selectedSubTournament?.id ?? null,
        parseStatus: "done",
        parsedAt: new Date(),
        error: null,
      });
    }

    await tx.delete(results).where(and(eq(results.stageId, stageId), eq(results.division, preview.division)));
    await tx.delete(matches).where(and(eq(matches.stageId, stageId), eq(matches.division, preview.division)));

    const resultRows = importPlayers.flatMap((p) => {
      const playerId = ridToDbId.get(p.rankedinId);
      if (!playerId) return [];
      return {
        stageId,
        division: preview.division,
        playerId,
        place: p.place,
        matches: p.matches,
        wonMatches: p.wins,
        lostMatches: p.losses,
        games: p.games,
        wonGames: p.wonGames,
        lostGames: p.lostGames,
        balls: p.balls,
        wonBalls: p.wonBalls,
        lostBalls: p.lostBalls,
        courtMinutes: p.courtMinutes,
        rank: p.ratingAfter === null ? null : Math.round(p.ratingAfter * 100),
        skill: p.ratingAfter === null ? null : p.ratingAfter.toFixed(1),
        ratingBefore: p.ratingBefore === null ? null : p.ratingBefore.toFixed(2),
        ratingAfter: p.ratingAfter === null ? null : p.ratingAfter.toFixed(2),
        points: 0,
      };
    });
    if (resultRows.length) await tx.insert(results).values(resultRows);

    const rosterRows = importPlayers.flatMap((p) => {
      const playerId = ridToDbId.get(p.rankedinId);
      return playerId ? [{ seasonId, division: preview.division, playerId }] : [];
    });
    for (const row of rosterRows) {
      await tx.insert(rosters).values(row).onConflictDoNothing();
    }

    const matchRows = importMatches.flatMap((m) => {
      const playerAId = ridToDbId.get(m.playerAId);
      const playerBId = ridToDbId.get(m.playerBId);
      const winnerId = ridToDbId.get(m.winnerRankedinId);
      if (!playerAId || !playerBId) return [];
      const cf = matchComebackFlags(m.scoreDetail, m.gamesA, m.gamesB);
      const reverseSweepWinnerId = cf.isReverseSweep
        ? cf.reverseSweepWinnerIsA
          ? playerAId
          : playerBId
        : null;
      const reverseSweepLoserId = cf.isReverseSweep
        ? cf.reverseSweepWinnerIsA
          ? playerBId
          : playerAId
        : null;
      return {
        stageId,
        division: preview.division,
        playerAId,
        playerBId,
        gamesA: m.gamesA,
        gamesB: m.gamesB,
        winnerId: winnerId ?? null,
        scoreDetail: m.scoreDetail,
        durationMinutes: m.durationMinutes,
        retired: m.retired,
        playerATrailed0_2: cf.playerATrailed0_2,
        playerBTrailed0_2: cf.playerBTrailed0_2,
        playerALed2_0: cf.playerALed2_0,
        playerBLed2_0: cf.playerBLed2_0,
        isReverseSweep: cf.isReverseSweep,
        reverseSweepWinnerId,
        reverseSweepLoserId,
        wasFifthForcedAfter0_2: cf.wasFifthForcedAfter0_2,
      };
    });
    if (matchRows.length) await tx.insert(matches).values(matchRows);

    return { stageId, matches: matchRows.length, players: resultRows.length };
  });

  await recalcStageDivision(result.stageId, preview.division);

  return {
    ok: true,
    tournamentId: preview.tournamentId,
    players: result.players,
    matches: result.matches,
    season: preview.season,
    division: preview.division,
    stage: preview.stage,
  };
}

async function parseRankedinTournament(input: StageImportInput): Promise<ParseRankedinTournamentResult> {
  const tournamentId = extractTournamentId(input.tournament);
  if (!tournamentId) throw new Error("Укажите ID турнира или ссылку RankedIn");

  const tournamentInfoUrl = `${API_BASE_URL}/tournament/GetInfoAsync?id=${encodeURIComponent(tournamentId)}&language=en`;
  const tournamentInfoResponse = await fetchJson(tournamentInfoUrl);
  const tournamentInfo = asRecord(tournamentInfoResponse.TournamentSidebarModel) ?? tournamentInfoResponse;

  const tournamentName = getTournamentName(tournamentInfo);
  const tournamentUrl = buildTournamentUrl(tournamentInfo, tournamentId);
  const resultsPageUrl = `${tournamentUrl}/results`;
  const matchesPageUrl = `${tournamentUrl}/matches`;
  const matchesApiUrl = `${API_BASE_URL}/tournament/GetMatchesSectionAsync?Id=${encodeURIComponent(tournamentId)}&LanguageCode=en&IsReadonly=true`;
  const selectedSubTournament = resolveSubTournamentSelection(tournamentInfo, tournamentName, input.classId);
  if (selectedSubTournament.kind === "subtournaments") {
    return {
      kind: "subtournaments",
      subtournaments: {
        tournamentId,
        tournamentName,
        tournamentUrl,
        resultsPageUrl,
        matchesPageUrl,
        options: selectedSubTournament.options,
      },
    };
  }

  const matchesData = await fetchJson(matchesApiUrl);
  if (!Array.isArray(matchesData.Matches)) {
    throw new Error("GetMatchesSectionAsync не вернул массив Matches");
  }
  const selectedMatchesData = selectedSubTournament.selected
    ? filterMatchesByClass(matchesData, selectedSubTournament.selected)
    : matchesData;

  const { resultsData } = await fetchResultsData(tournamentId, tournamentInfo, selectedSubTournament.selected?.id);
  if (resultsData.length === 0) {
    throw new Error("GetResultsAsync не вернул результаты по classId/rankingId");
  }

  const warnings = collectMatchValidationWarnings(selectedMatchesData).map((w) => w.message);

  // First pass over the raw feed, with nobody excluded. It is what the auto rule
  // (players who retired in every match) is derived from, and it keeps the
  // original numbers of the excluded players for the preview table.
  const fullStats = processMatches(selectedMatchesData, tournamentName);
  addPlayerStandings(fullStats, resultsData);
  const fullRows = buildPlayerRows(fullStats);
  const fullMatches = extractMatchRows(selectedMatchesData, tournamentName);

  const exclusions = collectExclusions(input, fullRows, fullMatches);
  const excludedIds = new Set(exclusions.map((e) => e.rankedinId));

  // Second pass with the excluded players removed from the aggregation, so the
  // opponents no longer carry the wins, games, balls and court time they earned
  // against them. Places are then closed up, since a place feeds the points table.
  let playersRows = fullRows;
  let matchRows = fullMatches;
  if (excludedIds.size > 0) {
    const keptStats = processMatches(selectedMatchesData, tournamentName, excludedIds);
    addPlayerStandings(keptStats, resultsData);
    const keptRows = closeUpPlaces(buildPlayerRows(keptStats));
    const keptById = new Map(keptRows.map((row) => [row.rankedinId, row]));
    playersRows = fullRows.map((row) => keptById.get(row.rankedinId) ?? row);
    matchRows = fullMatches.filter((m) => !excludedIds.has(m.playerAId) && !excludedIds.has(m.playerBId));
  }

  const inferred = inferTournamentMeta(tournamentName, matchRows);

  const season = input.season?.trim() || inferred.season;
  const division = input.division || inferred.division;
  const stage = input.stage || inferred.stage;
  const date = normalizeDate(input.date) || inferred.date;

  if (!season) throw new Error("Не удалось определить сезон. Укажите сезон вручную");
  if (!division) throw new Error("Не удалось определить дивизион. Укажите дивизион вручную");
  if (!stage) throw new Error("Не удалось определить этап. Укажите этап вручную");

  return {
    kind: "preview",
    parsed: {
      tournamentId,
      tournamentName,
      tournamentUrl,
      resultsPageUrl,
      matchesPageUrl,
      selectedSubTournament: selectedSubTournament.selected,
      season,
      division,
      stage,
      date,
      players: playersRows,
      matches: matchRows,
      warnings,
      exclusions,
    },
  };
}

export type StageImportExclusion = { rankedinId: string; reason: string };

/** Players kept out of the import: retired in every match (auto) or picked by the admin. */
function collectExclusions(
  input: StageImportInput,
  playersRows: ParsedStagePlayer[],
  matchRows: ParsedStageMatch[],
): StageImportExclusion[] {
  const manual = new Set((input.excludedRankedinIds ?? []).map((id) => id.trim()).filter(Boolean));
  const out: StageImportExclusion[] = [];
  const seen = new Set<string>();
  const add = (id: string, reason: string) => {
    if (!id || seen.has(id)) return;
    out.push({ rankedinId: id, reason });
    seen.add(id);
  };
  for (const player of playersRows) {
    if (isFakeRankedinId(player.rankedinId)) add(player.rankedinId, "Фейковый профиль (ID F…)");
  }
  for (const id of getRetiredOnlyPlaceZeroPlayerIds(playersRows, matchRows)) add(id, "Retired во всех матчах");
  for (const id of manual) add(id, "Исключён вручную");
  return out;
}

/** Renumber places into 1..N: a removed player must not leave a hole that the
 * points table would read as a worse finish for everyone below him. */
function closeUpPlaces(rows: ParsedStagePlayer[]): ParsedStagePlayer[] {
  const ranked = rows
    .filter((row) => row.place > 0)
    .map((row) => row.place)
    .sort((a, b) => a - b);
  const closedUp = new Map<number, number>();
  for (const place of ranked) {
    if (!closedUp.has(place)) closedUp.set(place, closedUp.size + 1);
  }
  return rows.map((row) => (row.place > 0 ? { ...row, place: closedUp.get(row.place) ?? row.place } : row));
}

async function classifyPlayers(playersRows: ParsedStagePlayer[]) {
  const out = new Map<string, Omit<StageImportPlayerPreview, keyof ParsedStagePlayer>>();
  const ids = playersRows.map((p) => p.rankedinId).filter(Boolean);
  const byId = await findPlayersByRankedinIds(ids);
  const allPlayers = await db
    .select({
      id: players.id,
      rankedinId: players.rankedinId,
      rankedinName: players.rankedinName,
      adminName: players.adminName,
      name: players.name,
    })
    .from(players);

  for (const row of playersRows) {
    const exact = byId.get(row.rankedinId);
    if (exact) {
      out.set(row.rankedinId, {
        status: "matched",
        existingPlayerId: exact.id,
        existingRankedinId: exact.rankedinId,
        existingRankedinName: exact.rankedinName,
      });
      continue;
    }

    const rowName = normalizeName(row.name);
    const possibleMatches = allPlayers
      .filter((p) =>
        [p.name, p.rankedinName, p.adminName ?? ""]
          .map(normalizeName)
          .some((name) => name && name === rowName),
      )
      .map((p) => ({
        playerId: p.id,
        rankedinId: p.rankedinId,
        rankedinName: p.rankedinName,
        name: p.name,
      }));

    out.set(row.rankedinId, { status: "new", possibleMatches });
  }

  return out;
}

function getRetiredOnlyPlaceZeroPlayerIds(playersRows: ParsedStagePlayer[], matchRows: ParsedStageMatch[]) {
  const excluded = new Set<string>();
  for (const player of playersRows) {
    if (player.place !== 0) continue;
    const playerMatches = matchRows.filter((m) => m.playerAId === player.rankedinId || m.playerBId === player.rankedinId);
    if (playerMatches.length > 0 && playerMatches.every((m) => m.retired)) {
      excluded.add(player.rankedinId);
    }
  }
  return excluded;
}

function resolveSubTournamentSelection(
  tournamentInfo: AnyRecord,
  tournamentName: string,
  requestedClassId?: string,
):
  | { kind: "selected"; selected: RankedInSubTournamentOption | null }
  | { kind: "subtournaments"; options: RankedInSubTournamentOption[] } {
  const options = getSubTournamentOptions(tournamentInfo);
  if (options.length <= 1) return { kind: "selected", selected: null };
  if (detectFinalSplitFromTournamentName(tournamentName)) return { kind: "selected", selected: null };

  const classId = requestedClassId?.trim();
  if (classId) {
    const selected = options.find((item) => item.id === classId);
    if (!selected) {
      throw new Error(`Подтурнир ${classId} не найден. Доступны: ${options.map((item) => item.id).join(", ")}`);
    }
    return { kind: "selected", selected };
  }

  return { kind: "subtournaments", options };
}

function getSubTournamentOptions(tournamentInfo: AnyRecord): RankedInSubTournamentOption[] {
  return asArray(tournamentInfo.Classes)
    .map((item) => ({
      id: String(item.Id ?? "").trim(),
      name: String(item.Name ?? "").trim(),
    }))
    .filter((item) => item.id || item.name);
}

function filterMatchesByClass(matchesData: AnyRecord, selectedClass: RankedInSubTournamentOption): AnyRecord {
  const selectedName = normalizeName(selectedClass.name);
  const filteredMatches = asArray(matchesData.Matches).filter((match) => normalizeName(String(match.TournamentClassName ?? "")) === selectedName);
  if (filteredMatches.length === 0) {
    throw new Error(`Для подтурнира ${selectedClass.id} (${selectedClass.name}) не найдены матчи`);
  }
  return {
    ...matchesData,
    Matches: filteredMatches,
  };
}

async function fetchResultsData(tournamentId: string, tournamentInfo: AnyRecord, selectedClassId?: string) {
  let classIds = selectedClassId ? [selectedClassId] : getIds(tournamentInfo.Classes);
  const rankingIds = getRankingIds(tournamentInfo.Rankings);
  const resultGroups: { classId: string | number | null; className: string; count: number; data: AnyRecord[] }[] = [];
  const classNamesById = new Map(
    asArray(tournamentInfo.Classes).map((item) => [String(item.Id ?? ""), String(item.Name ?? "")]),
  );

  if (classIds.length === 0) classIds = [null];
  const rankingIdsSafe = rankingIds.length ? rankingIds : [null];

  for (const classId of classIds) {
    let classResults: AnyRecord[] = [];

    for (const rankingId of rankingIdsSafe) {
      const apiUrl = buildResultsApiUrl(tournamentId, classId, rankingId);
      const response = await fetchJson(apiUrl);
      const data = asArray(response.Data);

      if (data.length > 0) {
        classResults = data.map((item) => ({
          ...item,
          __classId: classId,
          __className: classNamesById.get(String(classId ?? "")) || "",
          __rankingId: rankingId,
          __rankedinStanding: item.Standing,
        }));
        break;
      }
    }

    if (classResults.length > 0) {
      resultGroups.push({
        classId,
        className: classNamesById.get(String(classId ?? "")) || "",
        count: classResults.length,
        data: classResults,
      });
    }
  }

  normalizeFinalStandings(resultGroups, tournamentInfo);
  return { resultsData: deduplicateResults(resultGroups.flatMap((group) => group.data)) };
}

function normalizeFinalStandings(
  resultGroups: { classId: string | number | null; className: string; count: number; data: AnyRecord[] }[],
  tournamentInfo: AnyRecord,
) {
  const expectedSplit = detectFinalSplitFromTournamentName(getTournamentName(tournamentInfo));
  if (resultGroups.length <= 1) {
    for (const group of resultGroups) {
      for (const item of group.data) item.__finalStanding = item.Standing;
    }
    return;
  }

  const groupsStartingAtOne = resultGroups.filter((group) => group.data.some((item) => Number(item.Standing) === 1));
  if (groupsStartingAtOne.length <= 1) {
    for (const group of resultGroups) {
      for (const item of group.data) item.__finalStanding = item.Standing;
    }
    return;
  }

  const topGroup = chooseTopResultGroup(resultGroups, expectedSplit);
  const offset = topGroup.count;
  for (const group of resultGroups) {
    const isTopGroup = group === topGroup;
    for (const item of group.data) item.__finalStanding = isTopGroup ? item.Standing : Number(item.Standing) + offset;
  }
}

function chooseTopResultGroup<T extends { count: number }>(resultGroups: T[], expectedSplit: number | null): T {
  if (expectedSplit) {
    const expectedGroup = resultGroups.find((group) => group.count === expectedSplit);
    if (expectedGroup) return expectedGroup;
  }

  return [...resultGroups].sort((a, b) => {
    const aPreferred = a.count === 4 || a.count === 8 ? 0 : 1;
    const bPreferred = b.count === 4 || b.count === 8 ? 0 : 1;
    return aPreferred - bPreferred || a.count - b.count;
  })[0];
}

function detectFinalSplitFromTournamentName(tournamentName: string) {
  const normalizedName = tournamentName.toLowerCase();
  const isFinalStage =
    /(^|[^a-zа-я0-9])ix([^a-zа-я0-9]|$)/i.test(tournamentName) ||
    /(^|\D)9(\D|$)/.test(normalizedName) ||
    normalizedName.includes("final") ||
    normalizedName.includes("финал");

  if (!isFinalStage) return null;
  if (/(^|[^0-9])1\s*(дивизион|division|divizion)/i.test(tournamentName)) return 4;
  if (/(^|[^0-9])[23]\s*(дивизион|division|divizion)/i.test(tournamentName)) return 8;
  return null;
}

function deduplicateResults(rows: AnyRecord[]) {
  const seen = new Set<string>();
  const deduplicated: AnyRecord[] = [];
  for (const item of rows) {
    const key = `${normalizeName(String(item.Player1Name ?? ""))}|${String(item.__classId ?? "")}|${String(item.__rankedinStanding ?? "")}`;
    if (!seen.has(key)) {
      deduplicated.push(item);
      seen.add(key);
    }
  }
  return deduplicated;
}

function processMatches(data: AnyRecord, tournamentName: string, excluded?: ReadonlySet<string>) {
  const playersData = new Map<string, InternalPlayerStats>();
  for (const match of asArray(data.Matches)) {
    const firstParticipant = asRecord(match.Challenger);
    const secondParticipant = asRecord(match.Challenged);
    const firstName = getParticipantName(firstParticipant);
    const secondName = getParticipantName(secondParticipant);
    if (!firstName || !secondName) continue;
    if (excluded?.size) {
      // Skip before the players are created: an excluded player must leave no
      // trace, neither a row of his own nor a win in an opponent's tally.
      if (excluded.has(getParticipantId(firstParticipant)) || excluded.has(getParticipantId(secondParticipant))) continue;
    }

    const tournamentClass = String(match.TournamentClassName ?? "");
    ensurePlayer(playersData, firstName, tournamentName, tournamentClass, firstParticipant);
    ensurePlayer(playersData, secondName, tournamentName, tournamentClass, secondParticipant);

    const result = asRecord(match.MatchResult);
    if (!result || !isPlayedMatch(result)) continue;

    const score = asRecord(result.Score) ?? {};
    const isRetired = isRetiredMatch(result);
    const winnerName = firstName;
    const loserName = secondName;
    const winner = playersData.get(winnerName);
    const loser = playersData.get(loserName);
    const first = playersData.get(firstName);
    const second = playersData.get(secondName);
    if (!winner || !loser || !first || !second) continue;

    winner.wins += 1;
    loser.losses += 1;

    if (!isRetired && result.TotalDurationInMinutes !== null && result.TotalDurationInMinutes !== undefined) {
      const duration = Number(result.TotalDurationInMinutes) || 0;
      first.courtMinutes += duration;
      second.courtMinutes += duration;
    }

    const firstGames = isRetired ? 3 : numberOrDefault(score.FirstParticipantScore, 3);
    const secondGames = isRetired ? 0 : numberOrDefault(score.SecondParticipantScore, 0);
    first.wonGames += firstGames;
    first.lostGames += secondGames;
    second.wonGames += secondGames;
    second.lostGames += firstGames;

    const detailedScoring = asArray(score.DetailedScoring);
    if (isRetired) {
      winner.wonBalls += 33;
      loser.lostBalls += 33;
    } else if (detailedScoring.length > 0) {
      for (const game of detailedScoring) {
        const firstPoints = Number(game.FirstParticipantScore) || 0;
        const secondPoints = Number(game.SecondParticipantScore) || 0;
        first.wonBalls += firstPoints;
        first.lostBalls += secondPoints;
        second.wonBalls += secondPoints;
        second.lostBalls += firstPoints;
      }
    } else if (result.TotalDurationInMinutes === null || result.TotalDurationInMinutes === undefined) {
      winner.wonBalls += 33;
      loser.lostBalls += 33;
    }
  }
  return playersData;
}

function addPlayerStandings(playersData: Map<string, InternalPlayerStats>, resultsData: AnyRecord[]) {
  const byNormalizedName = new Map<string, string>();
  for (const playerName of playersData.keys()) byNormalizedName.set(normalizeName(playerName), playerName);

  for (const item of resultsData) {
    const playerName = String(item.Player1Name ?? "");
    const exactName = playersData.has(playerName) ? playerName : byNormalizedName.get(normalizeName(playerName));
    if (!exactName) continue;
    const stats = playersData.get(exactName);
    if (!stats) continue;
    stats.place = numberOrDefault(item.__finalStanding ?? item.Standing, 0);
    stats.rankedinPlace = numberOrDefault(item.__rankedinStanding ?? item.Standing, 0);
    stats.resultClassId = String(item.__classId ?? "");
    stats.resultClassName = String(item.__className ?? "");
    stats.ratingBefore = nullableNumber(item.Player1RatingBegin);
    stats.ratingAfter = nullableNumber(item.Player1RatingEnd);
    stats.rankedinId = stats.rankedinId || extractRankedinPlayerIds(item)[0] || "";
    stats.playerUrl = stats.playerUrl || buildRankedinUrls(item);
  }
}

function extractMatchRows(matchesData: AnyRecord, tournamentName: string): ParsedStageMatch[] {
  const rows: ParsedStageMatch[] = [];
  for (const match of asArray(matchesData.Matches)) {
    const firstParticipant = asRecord(match.Challenger);
    const secondParticipant = asRecord(match.Challenged);
    const firstName = getParticipantName(firstParticipant);
    const secondName = getParticipantName(secondParticipant);
    const result = asRecord(match.MatchResult) ?? {};
    const score = asRecord(result.Score) ?? {};
    const isRetired = isRetiredMatch(result);
    const isPlayed = isPlayedMatch(result);
    const gamesA = isRetired ? 3 : numberOrDefault(score.FirstParticipantScore, 0);
    const gamesB = isRetired ? 0 : numberOrDefault(score.SecondParticipantScore, 0);
    const detail = isRetired ? retiredScoreDetail() : extractScoreDetail(score);
    rows.push({
      tournament: tournamentName,
      date: normalizeDate(match.Date) || "",
      category: String(match.TournamentClassName ?? ""),
      draw: String(match.Draw ?? ""),
      court: String(match.Court ?? ""),
      playerAId: getParticipantId(firstParticipant),
      playerAName: firstName,
      playerBId: getParticipantId(secondParticipant),
      playerBName: secondName,
      winnerName: isPlayed ? firstName : "",
      winnerRankedinId: isPlayed ? getParticipantId(firstParticipant) : "",
      gamesA,
      gamesB,
      scoreDetail: detail,
      durationMinutes: isRetired ? 0 : numberOrDefault(result.TotalDurationInMinutes, 0),
      retired: getRetiredValue(result),
    });
  }
  return rows.filter((row) => row.playerAId && row.playerBId && row.gamesA + row.gamesB > 0);
}

function buildPlayerRows(playersData: Map<string, InternalPlayerStats>): ParsedStagePlayer[] {
  return [...playersData.values()]
    .filter((stats) => stats.rankedinId)
    .sort((a, b) => {
      if (a.place && b.place && a.place !== b.place) return a.place - b.place;
      const classCompare = a.tournamentClass.localeCompare(b.tournamentClass, "ru");
      return classCompare || b.courtMinutes - a.courtMinutes;
    })
    .map((stats) => ({
      tournament: stats.tournament,
      rankedinId: stats.rankedinId,
      name: stats.name,
      playerUrl: stats.playerUrl,
      place: stats.place,
      rankedinPlace: stats.rankedinPlace,
      resultClassId: stats.resultClassId,
      resultClassName: stats.resultClassName,
      ratingBefore: stats.ratingBefore,
      ratingAfter: stats.ratingAfter,
      matches: stats.wins + stats.losses,
      wins: stats.wins,
      losses: stats.losses,
      courtMinutes: stats.courtMinutes,
      games: stats.wonGames + stats.lostGames,
      wonGames: stats.wonGames,
      lostGames: stats.lostGames,
      balls: stats.wonBalls + stats.lostBalls,
      wonBalls: stats.wonBalls,
      lostBalls: stats.lostBalls,
    }));
}

function ensurePlayer(
  playersData: Map<string, InternalPlayerStats>,
  playerName: string,
  tournamentName: string,
  tournamentClass: string,
  participant: AnyRecord | null,
) {
  const existing = playersData.get(playerName);
  if (existing) {
    existing.rankedinId = existing.rankedinId || getParticipantId(participant);
    existing.playerUrl = existing.playerUrl || buildRankedinUrls(participant);
    return;
  }

  playersData.set(playerName, {
    tournament: tournamentName,
    rankedinId: getParticipantId(participant),
    name: playerName,
    playerUrl: buildRankedinUrls(participant),
    place: 0,
    rankedinPlace: 0,
    resultClassId: "",
    resultClassName: "",
    ratingBefore: null,
    ratingAfter: null,
    matches: 0,
    wins: 0,
    losses: 0,
    courtMinutes: 0,
    games: 0,
    wonGames: 0,
    lostGames: 0,
    balls: 0,
    wonBalls: 0,
    lostBalls: 0,
    tournamentClass,
  });
}

function collectMatchValidationWarnings(matchesData: AnyRecord) {
  const warnings: { message: string }[] = [];
  for (const match of asArray(matchesData.Matches)) {
    const result = asRecord(match.MatchResult);
    if (!result || !isPlayedMatch(result)) continue;
    const firstName = getParticipantName(asRecord(match.Challenger));
    const secondName = getParticipantName(asRecord(match.Challenged));
    const score = asRecord(result.Score);
    const checks: [string, unknown][] = [
      ["MatchResult.IsFirstParticipantWinner", result.IsFirstParticipantWinner],
      ["MatchResult.Score.IsFirstParticipantWinner", score?.IsFirstParticipantWinner],
    ];
    for (const [field, value] of checks) {
      if (typeof value === "boolean" && value !== true) {
        warnings.push({
          message: `матч ${String(match.Id ?? "(без ID)")}: ${field}=${String(value)}, Challenger считается победителем (${firstName} > ${secondName}).`,
        });
      }
    }
  }
  return warnings;
}

function inferTournamentMeta(tournamentName: string, matchesRows: ParsedStageMatch[]) {
  return {
    season: inferSeason(tournamentName),
    division: inferDivision(tournamentName),
    stage: inferStage(tournamentName),
    date: matchesRows.map((m) => m.date).find(Boolean) ?? "",
  };
}

function inferSeason(name: string) {
  const full = name.match(/20(\d{2})\s*[/-]\s*(\d{2,4})/);
  if (full) return `${full[1]}/${full[2].slice(-2)}`;
  const short = name.match(/(^|[^0-9])(\d{2})\s*[/-]\s*(\d{2})([^0-9]|$)/);
  return short ? `${short[2]}/${short[3]}` : "";
}

function inferDivision(name: string) {
  const match = name.match(/(^|[^0-9])([123])\s*(дивизион|division|divizion|див)/i);
  return match ? Number(match[2]) : 0;
}

function inferStage(name: string) {
  const roman = name.match(/\b(ix|viii|vii|vi|iv|v|iii|ii|i)\s*(этап|stage)\b/i);
  if (roman) return romanToNumber(roman[1]);
  const before = name.match(/(^|[^0-9])([1-9])\s*[-–]?\s*(й|ый|ой|th|st|nd|rd)?\s*(этап|stage)\b/i);
  if (before) return Number(before[2]);
  const after = name.match(/\b(этап|stage)\s*([1-9])\b/i);
  return after ? Number(after[2]) : 0;
}

function romanToNumber(value: string) {
  const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
  return map[value.toLowerCase()] ?? 0;
}

function extractTournamentId(input: string) {
  const value = input.trim();
  const idParam = value.match(/[?&]id=([^&#]+)/i)?.[1];
  if (idParam) return decodeURIComponent(idParam);
  const pathId = value.match(/\/tournament\/([^/?#]+)/i)?.[1];
  if (pathId) return decodeURIComponent(pathId);
  const plain = value.match(/[A-Za-z0-9_-]+/);
  return plain?.[0] ?? "";
}

function buildResultsApiUrl(tournamentId: string, classId: string | number | null, rankingId: string | number | null) {
  const url = new URL(`${API_BASE_URL}/tournament/GetResultsAsync`);
  url.searchParams.set("tournamentId", tournamentId);
  if (classId !== null && classId !== undefined) url.searchParams.set("classId", String(classId));
  if (rankingId !== null && rankingId !== undefined) url.searchParams.set("rankingId", String(rankingId));
  url.searchParams.set("language", "en");
  return url.toString();
}

async function fetchJson(url: string): Promise<AnyRecord> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "bbr-statistics/1.0",
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status} для ${url}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text) as unknown;
  const record = asRecord(parsed);
  if (!record) throw new Error(`JSON для ${url} не объект`);
  return record;
}

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : null;
}

function asArray(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is AnyRecord => item !== null) : [];
}

function getIds(value: unknown): (string | number | null)[] {
  return asArray(value).map((item) => item.Id as string | number | null).filter((id) => id !== undefined);
}

function getRankingIds(value: unknown): (string | number | null)[] {
  const rankings = asArray(value);
  const all = getIds(rankings);
  const approved = rankings
    .filter((ranking) => ranking.Id !== null && ranking.Id !== undefined && ranking.IsApproved !== false)
    .map((ranking) => ranking.Id as string | number);
  return approved.length > 0 ? approved : all;
}

function getTournamentName(tournamentInfo: AnyRecord) {
  return String(tournamentInfo.TournamentName ?? tournamentInfo.Name ?? tournamentInfo.name ?? "");
}

function buildTournamentUrl(tournamentInfo: AnyRecord, tournamentId: string) {
  const url = String(tournamentInfo.Url ?? tournamentInfo.URL ?? "");
  if (!url) return `${SITE_BASE_URL}/en/tournament/${encodeURIComponent(tournamentId)}`;
  if (/^https?:\/\//i.test(url)) return trimTrailingSlash(url);
  return `${SITE_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

function getParticipantName(participant: AnyRecord | null) {
  return participant ? String(participant.Name ?? participant.Player1Name ?? "") : "";
}

function getParticipantId(participant: AnyRecord | null) {
  return extractRankedinPlayerIds(participant).join(", ");
}

function extractRankedinPlayerIds(source: AnyRecord | null) {
  if (!source) return [];
  return [source.Player1Url, source.Player2Url, source.Url]
    .filter(Boolean)
    .map((url) => extractRankedinPlayerIdFromUrl(String(url)))
    .filter(Boolean);
}

function extractRankedinPlayerIdFromUrl(url: string) {
  const match = url.match(/\/player\/([^/]+)/i);
  return match ? match[1] : "";
}

function buildRankedinUrls(source: AnyRecord | null) {
  if (!source) return "";
  return [source.Player1Url, source.Player2Url, source.Url]
    .filter(Boolean)
    .map((url) => buildRankedinUrl(String(url)))
    .join(", ");
}

function buildRankedinUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

function isPlayedMatch(matchResult: AnyRecord) {
  return (
    matchResult.IsPlayed === true ||
    matchResult.IsPlayed === false ||
    matchResult.HasScore === true ||
    matchResult.HasCancellation === true ||
    Boolean(matchResult.Score)
  );
}

function isRetiredMatch(matchResult: AnyRecord) {
  return matchResult.Retired === true || matchResult.IsPlayed === false;
}

function getRetiredValue(matchResult: AnyRecord) {
  if (!isRetiredMatch(matchResult)) return false;
  return matchResult.Retired === undefined ? true : Boolean(matchResult.Retired);
}

function extractScoreDetail(score: AnyRecord) {
  return asArray(score.DetailedScoring).map((game) => ({
    a: Number(game.FirstParticipantScore) || 0,
    b: Number(game.SecondParticipantScore) || 0,
  }));
}

function retiredScoreDetail() {
  return [
    { a: 11, b: 0 },
    { a: 11, b: 0 },
    { a: 11, b: 0 },
  ];
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function normalizeName(name: string) {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function numberOrDefault(value: unknown, defaultValue: number) {
  if (value === null || value === undefined || value === "") return defaultValue;
  const number = Number(value);
  return Number.isNaN(number) ? defaultValue : number;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function startYearOf(label: string) {
  const yy = Number(label.slice(0, 2));
  return 2000 + (Number.isFinite(yy) ? yy : 0);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
