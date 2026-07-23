import {
  TOTAL_STAGES,
  getRatingRows,
  getStageResults,
  type DivisionScope,
  type League,
  type RealMatch,
} from "@/lib/league";
import { toDigestMatch, type DigestMatch } from "@/lib/stage-digest";
import { rateMatch, stageFormIndex } from "@/lib/stats/match-rating";
import { getStrengthBand } from "@/lib/stats/compute";
import type { SeasonStrengthRow } from "@/lib/db/season-summary";
import { fmtCourt, matchesLabel, playersLabel, pluralRu } from "@/lib/format";

/**
 * End-of-season wrap-up built from the loaded league plus the season Strength
 * Rating movement. Division scopes add the podium and promotion/relegation
 * zones; the "all" scope covers cross-division awards and records.
 */

export type SeasonScope = DivisionScope;

/** Minimum season matches before a winrate record counts. */
const MIN_WR_MATCHES = 10;
/** Established rating threshold (mirrors the strength engine's provisional cut). */
const MIN_MVP_GAMES = 10;
/** Minimum rated season matches for the "most improved" award. */
const MIN_PROGRESS_GAMES = 8;
/** Minimum played stages for the stability award. */
const MIN_STABILITY_STAGES = 4;
/** League promotion rule is not encoded anywhere, so the zone is marked as candidates. */
export const PROMOTION_SPOTS = 2;

export type SeasonPerson = { rid: string; name: string };

export type SeasonSummary = {
  season: string;
  scope: SeasonScope;
  hasData: boolean;
  /** Distinct played stages in scope (final included). */
  stagesDone: number;
  totalStages: number;
  /** Final stage loaded for every division in scope. */
  seasonFinished: boolean;
  metrics: { players: number; matches: number; totalTime: number; fiveGame: number };
  /** Top-3 of the season rating. Division scopes only. */
  podium: (SeasonPerson & { place: number; points: number; wins: number; losses: number })[];
  promotion: SeasonPerson[];
  mvp: (SeasonPerson & { rating: number; band: string | null; games: number }) | null;
  progress: (SeasonPerson & { delta: number; from: number; to: number }) | null;
  stable: (SeasonPerson & { avgForm: number; spread: number; stages: number }) | null;
  records: {
    streak: (SeasonPerson & { length: number }) | null;
    bestWr: (SeasonPerson & { wrPct: number; wins: number; matches: number }) | null;
    mostMatches: (SeasonPerson & { matches: number }) | null;
    mostTime: (SeasonPerson & { minutes: number }) | null;
    longestMatch: (DigestMatch & { stage: number; division: number }) | null;
    comebackKing: (SeasonPerson & { comebacks: number }) | null;
    /** Fastest stage win by court time per match among stage winners (their best attempt). */
    fastestWin: (SeasonPerson & { stage: number; perMatch: number; minutes: number; matches: number }) | null;
  };
  attendance: {
    avgPct: number;
    perfect: SeasonPerson[];
    top: (SeasonPerson & { played: number; total: number; pct: number })[];
  };
  derby: {
    frequent: { a: SeasonPerson; b: SeasonPerson; matches: number; aWins: number; bWins: number; fiveGames: number } | null;
    closest: { a: SeasonPerson; b: SeasonPerson; matches: number; aWins: number; bWins: number; avgGameDiff: number; fiveGames: number } | null;
  };
};

function inScope(division: number, scope: SeasonScope): boolean {
  return scope === "all" || division === scope;
}

/** Distinct stage numbers with loaded results for a division. */
function playedStages(league: League, division: number): Set<number> {
  const out = new Set<number>();
  for (const r of league.results) if (r.div === division) out.add(r.stage);
  return out;
}

function stddev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

export function buildSeasonSummary(
  league: League,
  scope: SeasonScope,
  strength: Map<string, SeasonStrengthRow>,
): SeasonSummary {
  const divisions = scope === "all" ? ([1, 2, 3] as const).filter((d) => playedStages(league, d).size > 0) : [scope];
  const matches = league.matches.filter((m) => inScope(m.division, scope));
  const rows = getRatingRows(league, scope);

  const stageSet = new Set<number>();
  for (const d of divisions) for (const s of playedStages(league, d)) stageSet.add(s);
  const stagesDone = stageSet.size;
  const seasonFinished = divisions.length > 0 && divisions.every((d) => playedStages(league, d).has(TOTAL_STAGES));

  const empty: SeasonSummary = {
    season: league.season,
    scope,
    hasData: rows.length > 0,
    stagesDone,
    totalStages: TOTAL_STAGES,
    seasonFinished,
    metrics: { players: 0, matches: 0, totalTime: 0, fiveGame: 0 },
    podium: [],
    promotion: [],
    mvp: null,
    progress: null,
    stable: null,
    records: { streak: null, bestWr: null, mostMatches: null, mostTime: null, longestMatch: null, comebackKing: null, fastestWin: null },
    attendance: { avgPct: 0, perfect: [], top: [] },
    derby: { frequent: null, closest: null },
  };
  if (rows.length === 0) return empty;

  const metrics = {
    players: rows.length,
    matches: matches.length,
    totalTime: matches.reduce((s, m) => s + m.durationMin, 0),
    fiveGame: matches.filter((m) => m.gamesA + m.gamesB === 5).length,
  };

  /* ------------------------------------------------ podium + zones (div) --- */
  const podium =
    scope === "all"
      ? []
      : rows.slice(0, 3).map((r) => ({
          rid: r.rid,
          name: r.name,
          place: r.place,
          points: r.points,
          wins: r.wins,
          losses: r.matches - r.wins,
        }));
  const promotion =
    scope === "all" || scope === 1 ? [] : rows.slice(0, PROMOTION_SPOTS).map((r) => ({ rid: r.rid, name: r.name }));

  /* --------------------------------------------------------------- awards --- */
  const nameByRid = new Map(rows.map((r) => [r.rid, r.name]));

  let mvp: SeasonSummary["mvp"] = null;
  for (const r of rows) {
    const s = strength.get(r.rid);
    if (!s || s.rating == null || s.games < MIN_MVP_GAMES) continue;
    if (!mvp || s.rating > mvp.rating) {
      mvp = { rid: r.rid, name: r.name, rating: s.rating, band: getStrengthBand(s.rating)?.labelRu ?? null, games: s.games };
    }
  }

  let progress: SeasonSummary["progress"] = null;
  for (const r of rows) {
    const s = strength.get(r.rid);
    if (!s || s.seasonGames < MIN_PROGRESS_GAMES || s.seasonDelta <= 0) continue;
    if (!progress || s.seasonDelta > progress.delta) {
      progress = { rid: r.rid, name: r.name, delta: s.seasonDelta, from: s.seasonStart, to: s.seasonEnd };
    }
  }

  // Stability: smallest spread of the per-stage Form Index across played stages.
  const formsByRid = new Map<string, number[]>();
  for (const stage of stageSet) {
    for (const r of getStageResults(league, stage, scope)) {
      if (r.matches < 2) continue;
      if (!nameByRid.has(r.rid)) continue;
      const list = formsByRid.get(r.rid) ?? [];
      list.push(stageFormIndex(r));
      formsByRid.set(r.rid, list);
    }
  }
  let stable: SeasonSummary["stable"] = null;
  for (const [rid, forms] of formsByRid) {
    if (forms.length < MIN_STABILITY_STAGES) continue;
    const spread = stddev(forms);
    const avgForm = forms.reduce((s, v) => s + v, 0) / forms.length;
    if (!stable || spread < stable.spread || (spread === stable.spread && avgForm > stable.avgForm)) {
      stable = { rid, name: nameByRid.get(rid) ?? "?", avgForm, spread, stages: forms.length };
    }
  }

  /* -------------------------------------------------------------- records --- */
  // Longest win streak: matches ordered by stage (in-stage order as loaded).
  const ordered = [...matches].sort((a, b) => a.stage - b.stage);
  const current = new Map<number, number>();
  const best = new Map<number, number>();
  for (const m of ordered) {
    const winner = m.winnerIdx;
    const loser = winner === m.aIdx ? m.bIdx : m.aIdx;
    const next = (current.get(winner) ?? 0) + 1;
    current.set(winner, next);
    if (next > (best.get(winner) ?? 0)) best.set(winner, next);
    current.set(loser, 0);
  }
  let streak: SeasonSummary["records"]["streak"] = null;
  for (const [idx, length] of best) {
    const p = league.players[idx];
    if (!p || !nameByRid.has(p.rid)) continue;
    if (!streak || length > streak.length) streak = { rid: p.rid, name: p.name, length };
  }

  let bestWr: SeasonSummary["records"]["bestWr"] = null;
  let mostMatches: SeasonSummary["records"]["mostMatches"] = null;
  let mostTime: SeasonSummary["records"]["mostTime"] = null;
  for (const r of rows) {
    if (r.matches >= MIN_WR_MATCHES) {
      const wrPct = (r.wins / r.matches) * 100;
      if (!bestWr || wrPct > bestWr.wrPct) bestWr = { rid: r.rid, name: r.name, wrPct, wins: r.wins, matches: r.matches };
    }
    if (!mostMatches || r.matches > mostMatches.matches) mostMatches = { rid: r.rid, name: r.name, matches: r.matches };
    if (!mostTime || r.court > mostTime.minutes) mostTime = { rid: r.rid, name: r.name, minutes: r.court };
  }

  const longestRaw = matches.reduce<RealMatch | null>(
    (bestM, m) => (bestM == null || m.durationMin > bestM.durationMin ? m : bestM),
    null,
  );
  const longestMatch = longestRaw
    ? { ...toDigestMatch(league, longestRaw), stage: longestRaw.stage, division: longestRaw.division }
    : null;

  const comebacksByIdx = new Map<number, number>();
  for (const m of matches) {
    if (m.retired) continue;
    if (rateMatch(m).label !== "Камбэк") continue;
    comebacksByIdx.set(m.winnerIdx, (comebacksByIdx.get(m.winnerIdx) ?? 0) + 1);
  }
  let comebackKing: SeasonSummary["records"]["comebackKing"] = null;
  for (const [idx, count] of comebacksByIdx) {
    const p = league.players[idx];
    if (!p || !nameByRid.has(p.rid)) continue;
    if (!comebackKing || count > comebackKing.comebacks) comebackKing = { rid: p.rid, name: p.name, comebacks: count };
  }

  // Fastest stage win: among stage winners (place 1), the smallest court time per
  // match. Stages differ in match count, so compare the per-match rate; a player
  // who won several stages is represented by his fastest one (the global min).
  let fastestWin: SeasonSummary["records"]["fastestWin"] = null;
  for (const stage of stageSet) {
    for (const r of getStageResults(league, stage, scope)) {
      if (r.place !== 1 || r.matches <= 0 || r.court <= 0) continue;
      const perMatch = r.court / r.matches;
      if (!fastestWin || perMatch < fastestWin.perMatch) {
        fastestWin = { rid: r.rid, name: r.name, stage, perMatch, minutes: r.court, matches: r.matches };
      }
    }
  }

  /* ----------------------------------------------------------- attendance --- */
  const playedByIdx = new Map<number, Set<number>>();
  const divsByIdx = new Map<number, Set<number>>();
  for (const r of league.results) {
    if (!inScope(r.div, scope)) continue;
    const set = playedByIdx.get(r.playerIdx) ?? new Set<number>();
    set.add(r.stage);
    playedByIdx.set(r.playerIdx, set);
    const divs = divsByIdx.get(r.playerIdx) ?? new Set<number>();
    divs.add(r.div);
    divsByIdx.set(r.playerIdx, divs);
  }
  const stagesByDiv = new Map<number, Set<number>>(divisions.map((d) => [d, playedStages(league, d)]));
  const attendanceRows: SeasonSummary["attendance"]["top"] = [];
  for (const [idx, played] of playedByIdx) {
    const p = league.players[idx];
    if (!p || !nameByRid.has(p.rid)) continue;
    // A player's own total: stages actually held in the divisions they appeared
    // in this season (from results, not the roster - guest starts count too).
    const total = new Set<number>();
    for (const d of divsByIdx.get(idx) ?? []) {
      for (const s of stagesByDiv.get(d) ?? []) total.add(s);
    }
    if (total.size === 0) continue;
    attendanceRows.push({
      rid: p.rid,
      name: p.name,
      played: played.size,
      total: total.size,
      pct: (played.size / total.size) * 100,
    });
  }
  attendanceRows.sort((a, b) => b.pct - a.pct || b.played - a.played || a.name.localeCompare(b.name, "ru"));
  const attendance = {
    avgPct: attendanceRows.length ? attendanceRows.reduce((s, r) => s + r.pct, 0) / attendanceRows.length : 0,
    perfect: attendanceRows.filter((r) => r.pct >= 100).map((r) => ({ rid: r.rid, name: r.name })),
    top: attendanceRows.slice(0, 5),
  };

  /* ---------------------------------------------------------------- derby --- */
  type Pair = { aIdx: number; bIdx: number; matches: number; aWins: number; bWins: number; fiveGames: number; gameDiffSum: number };
  const pairs = new Map<string, Pair>();
  for (const m of matches) {
    const [lo, hi] = m.aIdx < m.bIdx ? [m.aIdx, m.bIdx] : [m.bIdx, m.aIdx];
    const key = `${lo}-${hi}`;
    const pair = pairs.get(key) ?? { aIdx: lo, bIdx: hi, matches: 0, aWins: 0, bWins: 0, fiveGames: 0, gameDiffSum: 0 };
    pair.matches += 1;
    if (m.winnerIdx === lo) pair.aWins += 1;
    else pair.bWins += 1;
    if (m.gamesA + m.gamesB === 5) pair.fiveGames += 1;
    pair.gameDiffSum += Math.abs(m.gamesA - m.gamesB);
    pairs.set(key, pair);
  }
  const toDerby = (p: Pair) => {
    const a = league.players[p.aIdx];
    const b = league.players[p.bIdx];
    return {
      a: { rid: a?.rid ?? "", name: a?.name ?? "?" },
      b: { rid: b?.rid ?? "", name: b?.name ?? "?" },
      matches: p.matches,
      aWins: p.aWins,
      bWins: p.bWins,
      fiveGames: p.fiveGames,
      avgGameDiff: p.gameDiffSum / p.matches,
    };
  };
  let frequent: Pair | null = null;
  let closest: Pair | null = null;
  for (const p of pairs.values()) {
    if (!frequent || p.matches > frequent.matches || (p.matches === frequent.matches && p.fiveGames > frequent.fiveGames)) {
      frequent = p;
    }
    if (p.matches >= 2) {
      const diff = p.gameDiffSum / p.matches;
      const bestDiff = closest ? closest.gameDiffSum / closest.matches : Infinity;
      if (!closest || diff < bestDiff || (diff === bestDiff && p.matches > closest.matches)) closest = p;
    }
  }

  return {
    ...empty,
    hasData: true,
    metrics,
    podium,
    promotion,
    mvp,
    progress,
    stable,
    records: { streak, bestWr, mostMatches, mostTime, longestMatch, comebackKing, fastestWin },
    attendance,
    derby: {
      frequent: frequent ? toDerby(frequent) : null,
      closest: closest ? { ...toDerby(closest) } : null,
    },
  };
}

/* ----------------------------------------------------------------- caption --- */

/** Ready-to-copy season wrap-up text. */
export function seasonSummaryCaption(s: SeasonSummary): string {
  if (!s.hasData) return "";
  const lines: string[] = [];
  const scopeLabel = s.scope === "all" ? "Общие итоги" : `Дивизион ${s.scope}`;
  lines.push(`Итоги сезона ${s.season} - ${scopeLabel}`);
  if (!s.seasonFinished) lines.push(`(промежуточные: сыгран ${s.stagesDone} из ${s.totalStages} этапов)`);
  lines.push("");

  if (s.podium.length) {
    const champion = s.podium[0];
    lines.push(`Чемпион: ${champion.name} (${champion.wins}-${champion.losses}, ${champion.points} очков)`);
    if (s.podium.length > 1) {
      lines.push("Подиум:");
      for (const p of s.podium) lines.push(`${p.place}. ${p.name}`);
    }
    if (s.promotion.length) lines.push(`Кандидаты на повышение: ${s.promotion.map((p) => p.name).join(", ")}`);
    lines.push("");
  }

  if (s.mvp) lines.push(`MVP по рейтингу силы: ${s.mvp.name} (${s.mvp.rating}${s.mvp.band ? `, ${s.mvp.band}` : ""})`);
  if (s.progress) lines.push(`Прогресс сезона: ${s.progress.name} (+${s.progress.delta}: ${s.progress.from} → ${s.progress.to})`);
  if (s.stable) lines.push(`Самый стабильный: ${s.stable.name} (форма ${s.stable.avgForm.toFixed(1)} ± ${s.stable.spread.toFixed(1)})`);
  lines.push("");

  lines.push("Рекорды сезона:");
  if (s.records.streak) lines.push(`- Серия побед: ${s.records.streak.name} (${s.records.streak.length} подряд)`);
  if (s.records.bestWr)
    lines.push(`- Лучший winrate: ${s.records.bestWr.name} (${s.records.bestWr.wrPct.toFixed(0)}% при ${s.records.bestWr.matches} матчах)`);
  if (s.records.mostMatches) lines.push(`- Больше всех матчей: ${s.records.mostMatches.name} (${s.records.mostMatches.matches})`);
  if (s.records.mostTime) lines.push(`- Больше всех на корте: ${s.records.mostTime.name} (${fmtCourt(s.records.mostTime.minutes)})`);
  if (s.records.longestMatch) {
    const m = s.records.longestMatch;
    lines.push(`- Самый длинный матч: ${m.a.name} - ${m.b.name} (${fmtCourt(m.durationMin)}, этап ${m.stage})`);
  }
  if (s.records.comebackKing) {
    const c = s.records.comebackKing;
    lines.push(`- Король камбэков: ${c.name} (${c.comebacks} ${pluralRu(c.comebacks, ["камбэк", "камбэка", "камбэков"])})`);
  }
  if (s.records.fastestWin) {
    const f = s.records.fastestWin;
    lines.push(`- Самая быстрая победа: ${f.name} (${fmtCourt(Math.round(f.perMatch))}/матч, этап ${f.stage})`);
  }
  lines.push("");

  if (s.attendance.perfect.length) {
    lines.push(`Сыграли все этапы: ${s.attendance.perfect.map((p) => p.name).join(", ")}`);
  }
  lines.push(`Средняя явка: ${s.attendance.avgPct.toFixed(0)}%`);
  lines.push("");

  if (s.derby.frequent) {
    const d = s.derby.frequent;
    lines.push(`Дерби сезона: ${d.a.name} - ${d.b.name} (${d.matches} ${pluralRu(d.matches, ["встреча", "встречи", "встреч"])}, счёт ${d.aWins}-${d.bWins})`);
  }
  if (s.derby.closest) {
    const d = s.derby.closest;
    lines.push(`Самое упорное: ${d.a.name} - ${d.b.name} (средняя разница ${d.avgGameDiff.toFixed(1)} гейма, пятигеймовых: ${d.fiveGames})`);
  }
  lines.push("");

  const fiveWord = pluralRu(s.metrics.fiveGame, ["пятигеймовый матч", "пятигеймовых матча", "пятигеймовых матчей"]);
  lines.push(
    `Цифры сезона: ${playersLabel(s.metrics.players)} · ${matchesLabel(s.metrics.matches)} · ${fmtCourt(s.metrics.totalTime)} на корте · ${s.metrics.fiveGame} ${fiveWord}`,
  );
  return lines.join("\n");
}
