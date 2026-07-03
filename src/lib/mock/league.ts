/**
 * League data built from the real RankedIn tournament exports (see
 * src/lib/data/tournaments.ts). Player aggregates come from the players CSVs,
 * head-to-head matches from the matches CSVs. The query helpers below operate on
 * this normalized `League` shape; swap `buildLeague` for Drizzle queries later.
 *
 * `skill`/`rank` carry the real RankedIn rating; `points` is derived from final
 * placement (the CSVs don't include tournament ranking points).
 */

import { TOURNAMENTS, SEASON, SEASONS } from "@/lib/data/tournaments";
import { defaultPointsFor } from "@/lib/points";

export type MockPlayer = {
  idx: number;
  /** Display name used by the public app: adminName if set, otherwise rankedinName. */
  name: string;
  rankedinName: string;
  adminName?: string;
  rid: string;
  skill: number;
  rank: number;
  hue: number;
  color: string;
  initials: string;
  divisions: number[];
};

export type MockStage = { no: number; date: string; done: boolean };

export type MockResult = {
  div: number;
  stage: number;
  date: string;
  playerIdx: number;
  place: number;
  matches: number;
  wonM: number;
  lostM: number;
  games: number;
  wonG: number;
  lostG: number;
  balls: number;
  wonB: number;
  lostB: number;
  court: number;
  rank: number;
  ratingBefore: number;
  ratingAfter: number;
  points: number;
};

export type RealMatch = {
  stage: number;
  division: number;
  aIdx: number;
  bIdx: number;
  gamesA: number;
  gamesB: number;
  winnerIdx: number;
  detail: { a: number; b: number }[];
  durationMin: number;
  retired?: boolean;
};

export type League = {
  season: string;
  players: MockPlayer[];
  rosters: Record<number, number[]>;
  stages: MockStage[];
  results: MockResult[];
  matches: RealMatch[];
};

export const CURRENT_SEASON = SEASON;

/** Only the seasons present in the imported data. */
export function seasonList(): string[] {
  return [...SEASONS];
}

export function normalizeSeason(season?: string | null): string {
  // Accept any well-formed YY/YY label (incl. admin-imported seasons not in the
  // static seed list). loadLeague returns an empty league if it has no data.
  return season && /^\d{2}\/\d{2}$/.test(season) ? season : CURRENT_SEASON;
}

// Admin-controlled display names. Keep empty until an admin override is set.
// The public app always reads MockPlayer.name, which falls back to rankedinName.
const ADMIN_PLAYER_NAMES: Record<string, string> = {};

function displayNameFor(rid: string, rankedinName: string): string {
  return ADMIN_PLAYER_NAMES[rid]?.trim() || rankedinName;
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

/** Parse a RankedIn score like "3:1 (11:8, 10:12, 11:5, 11:3)". */
function parseScore(score: string): { gamesA: number; gamesB: number; detail: { a: number; b: number }[] } {
  const head = score.match(/^\s*(\d+)\s*:\s*(\d+)/);
  const gamesA = head ? +head[1] : 0;
  const gamesB = head ? +head[2] : 0;
  const detail: { a: number; b: number }[] = [];
  const paren = score.match(/\(([^)]*)\)/);
  if (paren) {
    for (const part of paren[1].split(",")) {
      const g = part.trim().match(/(\d+)\s*:\s*(\d+)/);
      if (g) detail.push({ a: +g[1], b: +g[2] });
    }
  }
  return { gamesA, gamesB, detail };
}

const leagueCache = new Map<string, League>();
const RATING_MAX_STAGE = 8;
const RATING_BEST_STAGE_COUNT = 7;

export function buildLeague(_season: string = CURRENT_SEASON): League {
  const season = normalizeSeason(_season);
  const cached = leagueCache.get(season);
  if (cached) return cached;

  const tournaments = TOURNAMENTS.filter((t) => t.season === season);

  const idToIdx = new Map<string, number>();
  const players: MockPlayer[] = [];

  for (const t of tournaments) {
    for (const pl of t.players) {
      if (!idToIdx.has(pl.id)) {
        const idx = players.length;
        idToIdx.set(pl.id, idx);
        const hue = hashHue(pl.id);
        const rankedinName = pl.name;
        const adminName = ADMIN_PLAYER_NAMES[pl.id]?.trim() || undefined;
        const displayName = displayNameFor(pl.id, rankedinName);
        players.push({
          idx,
          name: displayName,
          rankedinName,
          adminName,
          rid: pl.id,
          skill: pl.rating,
          rank: Math.round(pl.rating * 100),
          hue,
          color: `oklch(0.63 0.17 ${hue})`,
          initials: initialsOf(displayName),
          divisions: [],
        });
      } else {
        const ex = players[idToIdx.get(pl.id)!];
        if (pl.rating > ex.skill) {
          ex.skill = pl.rating;
          ex.rank = Math.round(pl.rating * 100);
        }
      }
    }
  }

  const rosters: Record<number, number[]> = { 1: [], 2: [], 3: [] };
  const results: MockResult[] = [];
  const stageDates = new Map<number, string>();

  for (const t of tournaments) {
    stageDates.set(t.stage, t.date);
    for (const pl of t.players) {
      const idx = idToIdx.get(pl.id)!;
      const player = players[idx];
      if (!player.divisions.includes(t.division)) player.divisions.push(t.division);
      if (!rosters[t.division].includes(idx)) rosters[t.division].push(idx);
      results.push({
        div: t.division,
        stage: t.stage,
        date: t.date,
        playerIdx: idx,
        place: pl.place,
        matches: pl.matches,
        wonM: pl.wins,
        lostM: pl.losses,
        games: pl.games,
        wonG: pl.gamesWon,
        lostG: pl.gamesLost,
        balls: pl.balls,
        wonB: pl.ballsWon,
        lostB: pl.ballsLost,
        court: pl.court,
        rank: Math.round(pl.rating * 100),
        ratingBefore: pl.ratingBefore,
        ratingAfter: pl.ratingAfter,
        points: defaultPointsFor(pl.place),
      });
    }
  }

  const matches: RealMatch[] = [];
  for (const t of tournaments) {
    for (const mt of t.matches) {
      const aIdx = idToIdx.get(mt.a);
      const bIdx = idToIdx.get(mt.b);
      if (aIdx == null || bIdx == null) continue;
      const { gamesA, gamesB, detail } = parseScore(mt.score);
      matches.push({
        stage: t.stage,
        division: t.division,
        aIdx,
        bIdx,
        gamesA,
        gamesB,
        winnerIdx: gamesA >= gamesB ? aIdx : bIdx,
        detail,
        durationMin: mt.dur,
      });
    }
  }

  for (const p of players) p.divisions.sort((a, b) => a - b);

  const stages: MockStage[] = Array.from({ length: 9 }, (_, i) => {
    const no = i + 1;
    const date = stageDates.get(no) ?? "";
    return { no, date, done: Boolean(date) };
  });

  const league = { season, players, rosters, stages, results, matches };
  leagueCache.set(season, league);
  return league;
}

export type Aggregate = {
  points: number;
  matches: number;
  wonM: number;
  games: number;
  wonG: number;
  balls: number;
  wonB: number;
  court: number;
  stages: number;
  best: number | null;
  fiveGameMatches: number;
};

function ratingPoints(results: MockResult[]): number {
  return results
    .filter((r) => r.stage <= RATING_MAX_STAGE)
    .map((r) => r.points)
    .sort((a, b) => b - a)
    .slice(0, RATING_BEST_STAGE_COUNT)
    .reduce((sum, points) => sum + points, 0);
}

export function aggregate(
  league: League,
  playerIdx: number,
  division?: number,
  maxStage = Number.POSITIVE_INFINITY,
): Aggregate {
  const rs = league.results.filter(
    (r) =>
      r.playerIdx === playerIdx &&
      r.stage <= maxStage &&
      (division == null ? true : r.div === division),
  );
  const a: Aggregate = {
    points: 0, matches: 0, wonM: 0, games: 0, wonG: 0, balls: 0, wonB: 0, court: 0,
    stages: 0, best: null, fiveGameMatches: 0,
  };
  const stagesSet = new Set<number>();
  for (const r of rs) {
    a.matches += r.matches;
    a.wonM += r.wonM;
    a.games += r.games;
    a.wonG += r.wonG;
    a.balls += r.balls;
    a.wonB += r.wonB;
    a.court += r.court;
    stagesSet.add(r.stage);
    if (a.best == null || r.place < a.best) a.best = r.place;
  }
  a.points = ratingPoints(rs);
  a.stages = stagesSet.size;
  a.fiveGameMatches = league.matches.filter(
    (m) =>
      m.stage <= maxStage &&
      (division == null ? true : m.division === division) &&
      (m.aIdx === playerIdx || m.bIdx === playerIdx) &&
      m.gamesA + m.gamesB === 5,
  ).length;
  return a;
}

export type RatingRow = {
  place: number;
  positionDelta: number;
  playerIdx: number;
  rid: string;
  name: string;
  initials: string;
  color: string;
  divisions: number[];
  matches: number;
  wins: number;
  winPct: number;
  games: number;
  gamesWon: number;
  balls: number;
  ballsWon: number;
  court: number;
  points: number;
  stages: number;
  best: number | null;
  fiveGameMatches: number;
  /** Points scored at the player's latest played stage (within scope). */
  lastStagePoints: number;
};

export type DivisionScope = "all" | 1 | 2 | 3;

/**
 * Count of distinct stages a player took part in within scope — counts ALL
 * stages incl. the 9th (which does not score in the rating, but participation
 * still counts here).
 */
function playerStagesParticipated(
  league: League,
  playerIdx: number,
  division: number | undefined,
): number {
  const set = new Set<number>();
  for (const r of league.results) {
    if (r.playerIdx !== playerIdx) continue;
    if (division != null && r.div !== division) continue;
    set.add(r.stage);
  }
  return set.size;
}

/** Points from the player's latest stage result within scope. */
function playerLastStagePoints(
  league: League,
  playerIdx: number,
  division: number | undefined,
  maxStage: number,
): number {
  let bestStage = -1;
  let pts = 0;
  for (const r of league.results) {
    if (r.playerIdx !== playerIdx || r.stage > maxStage) continue;
    if (division != null && r.div !== division) continue;
    if (r.stage > bestStage) {
      bestStage = r.stage;
      pts = r.points;
    }
  }
  return pts;
}

export type DivisionSummary = {
  stagesDone: number;
  activePlayers: number;
  matches: number;
  court: number;
};

export function getDivisionSummary(league: League, division: 1 | 2 | 3): DivisionSummary {
  const results = league.results.filter((r) => r.div === division);

  return {
    stagesDone: new Set(results.map((r) => r.stage)).size,
    activePlayers: new Set(results.map((r) => r.playerIdx)).size,
    matches: results.reduce((sum, r) => sum + r.matches, 0),
    court: results.reduce((sum, r) => sum + r.court, 0),
  };
}

function getRatingRowsAtStage(
  league: League,
  scope: DivisionScope,
  maxStage: number,
): RatingRow[] {
  const division = scope === "all" ? undefined : scope;
  const inScope =
    scope === "all"
      ? league.players
      : league.players.filter((p) => league.rosters[scope].includes(p.idx));

  const rows = inScope
    .map((p) => {
      const a = aggregate(league, p.idx, division, maxStage);
      return {
        positionDelta: 0,
        lastStagePoints: playerLastStagePoints(league, p.idx, division, maxStage),
        playerIdx: p.idx,
        rid: p.rid,
        name: p.name,
        initials: p.initials,
        color: p.color,
        divisions: p.divisions,
        matches: a.matches,
        wins: a.wonM,
        winPct: a.matches ? Math.round((a.wonM / a.matches) * 100) : 0,
        games: a.games,
        gamesWon: a.wonG,
        balls: a.balls,
        ballsWon: a.wonB,
        court: a.court,
        points: a.points,
        stages: playerStagesParticipated(league, p.idx, division),
        best: a.best,
        fiveGameMatches: a.fiveGameMatches,
      };
    })
    .filter((r) => r.matches > 0)
    .sort((x, y) => y.points - x.points || y.winPct - x.winPct);

  return rows.map((r, i) => ({ ...r, place: i + 1 }));
}

function getDivisionStandingPlacesAtStage(
  league: League,
  division: 1 | 2 | 3,
  maxStage: number,
): Map<number, number> {
  return new Map(
    getRatingRowsAtStage(league, division, maxStage).map((r) => [r.playerIdx, r.place]),
  );
}

export function getRatingRows(league: League, scope: DivisionScope): RatingRow[] {
  const latestStage =
    league.results
      .filter((r) => r.stage <= RATING_MAX_STAGE && (scope === "all" ? true : r.div === scope))
      .reduce((latest, r) => Math.max(latest, r.stage), 0) || RATING_MAX_STAGE;

  const rows = getRatingRowsAtStage(league, scope, latestStage);
  if (scope === "all" || latestStage <= 1) return rows;

  const previousPlaces = getDivisionStandingPlacesAtStage(league, scope, latestStage - 1);

  return rows.map((r) => {
    const previousPlace = previousPlaces.get(r.playerIdx);
    return {
      ...r,
      positionDelta: previousPlace == null ? 0 : previousPlace - r.place,
    };
  });
}

// --- Iron Man (court time over a half of the season) ---

export type IronRow = {
  pos: number;
  playerIdx: number;
  rid: string;
  name: string;
  initials: string;
  color: string;
  court: number;
  matches: number;
  stages: number;
  perStage: number;
  perMatch: number;
  gamesWon: number;
  gamesLost: number;
  fiveGameMatches: number;
  longestMatchMin: number;
};

export type IronManSummary = {
  totalCourt: number;
  players: number;
  matches: number;
  avgMatchMin: number;
};

export type IronLongMatch = {
  stage: number;
  div: number;
  aIdx: number;
  bIdx: number;
  aName: string;
  bName: string;
  gamesA: number;
  gamesB: number;
  detail: { a: number; b: number }[];
  durationMin: number;
  retired?: boolean;
};

/** Stage bounds for an Iron Man half. The 9th stage never counts (see RATING_MAX_STAGE). */
function ironStageRange(half: 1 | 2): (stage: number) => boolean {
  const [lo, hi] = half === 1 ? [1, 4] : [5, RATING_MAX_STAGE];
  return (stage: number) => stage >= lo && stage <= hi && stage <= RATING_MAX_STAGE;
}

export function getIronManRows(league: League, half: 1 | 2, scope: DivisionScope = "all"): IronRow[] {
  const inRange = ironStageRange(half);
  const inScope = (div: number) => scope === "all" || div === scope;
  const acc = new Map<
    number,
    { court: number; matches: number; gamesWon: number; gamesLost: number; stages: Set<number>; five: number; longest: number }
  >();
  for (const r of league.results) {
    if (!inRange(r.stage) || !inScope(r.div)) continue;
    const cur =
      acc.get(r.playerIdx) ??
      { court: 0, matches: 0, gamesWon: 0, gamesLost: 0, stages: new Set<number>(), five: 0, longest: 0 };
    cur.court += r.court;
    cur.matches += r.matches;
    cur.gamesWon += r.wonG;
    cur.gamesLost += r.lostG;
    cur.stages.add(r.stage);
    acc.set(r.playerIdx, cur);
  }
  // match-derived per player: five-game count + longest match
  for (const m of league.matches) {
    if (!inRange(m.stage) || !inScope(m.division)) continue;
    const isFive = m.gamesA + m.gamesB === 5 ? 1 : 0;
    for (const idx of [m.aIdx, m.bIdx]) {
      const cur = acc.get(idx);
      if (!cur) continue;
      cur.five += isFive;
      if (m.durationMin > cur.longest) cur.longest = m.durationMin;
    }
  }
  return [...acc.entries()]
    .map(([idx, v]) => {
      const p = league.players[idx];
      const stages = v.stages.size;
      return {
        pos: 0,
        playerIdx: idx,
        rid: p.rid,
        name: p.name,
        initials: p.initials,
        color: p.color,
        court: v.court,
        matches: v.matches,
        stages,
        perStage: stages ? Math.round(v.court / stages) : 0,
        perMatch: v.matches ? Math.round(v.court / v.matches) : 0,
        gamesWon: v.gamesWon,
        gamesLost: v.gamesLost,
        fiveGameMatches: v.five,
        longestMatchMin: v.longest,
      };
    })
    .sort((a, b) => b.court - a.court)
    .map((r, i) => ({ ...r, pos: i + 1 }));
}

/** Tiles for the Iron Man header — recomputed per scope+half. */
export function getIronManSummary(league: League, half: 1 | 2, scope: DivisionScope = "all"): IronManSummary {
  const inRange = ironStageRange(half);
  const inScope = (div: number) => scope === "all" || div === scope;
  let totalCourt = 0;
  const players = new Set<number>();
  for (const r of league.results) {
    if (!inRange(r.stage) || !inScope(r.div)) continue;
    totalCourt += r.court;
    players.add(r.playerIdx);
  }
  let matches = 0;
  let durSum = 0;
  for (const m of league.matches) {
    if (!inRange(m.stage) || !inScope(m.division)) continue;
    matches += 1;
    durSum += m.durationMin;
  }
  return { totalCourt, players: players.size, matches, avgMatchMin: matches ? Math.round(durSum / matches) : 0 };
}

/** Matches at/above `minMin` minutes within scope+half, longest first. */
export function getIronManLongMatches(
  league: League,
  half: 1 | 2,
  scope: DivisionScope = "all",
  minMin = 45,
): IronLongMatch[] {
  const inRange = ironStageRange(half);
  const inScope = (div: number) => scope === "all" || div === scope;
  return league.matches
    .filter((m) => inRange(m.stage) && inScope(m.division) && m.durationMin >= minMin)
    .sort((a, b) => b.durationMin - a.durationMin)
    .map((m) => ({
      stage: m.stage,
      div: m.division,
      aIdx: m.aIdx,
      bIdx: m.bIdx,
      aName: league.players[m.aIdx]?.name ?? "",
      bName: league.players[m.bIdx]?.name ?? "",
      gamesA: m.gamesA,
      gamesB: m.gamesB,
      detail: m.detail,
      durationMin: m.durationMin,
      retired: m.retired,
    }));
}

// --- Stage summaries ---

export type StageSummary = {
  no: number;
  date: string;
  done: boolean;
  participants: number;
  matches: number;
  divisions: number;
};

export function getStageSummaries(league: League): StageSummary[] {
  return league.stages.map((st) => {
    const rs = league.results.filter((r) => r.stage === st.no);
    const participants = new Set(rs.map((r) => r.playerIdx)).size;
    const matches = Math.round(rs.reduce((s, r) => s + r.matches, 0) / 2);
    const divisions = new Set(rs.map((r) => r.div)).size || 3;
    return { no: st.no, date: st.date, done: st.done, participants, matches, divisions };
  });
}

// --- Stage results (Этапы / сводка по этапу) ---

export type StageResultRow = {
  place: number;
  date: string;
  playerIdx: number;
  rid: string;
  name: string;
  initials: string;
  color: string;
  div: number;
  matches: number;
  wins: number;
  losses: number;
  games: number;
  gamesWon: number;
  gamesLost: number;
  balls: number;
  ballsWon: number;
  ballsLost: number;
  court: number;
  rank: number;
  points: number;
};

export function doneStageNumbers(league: League): number[] {
  return league.stages.filter((s) => s.done).map((s) => s.no);
}

export function getStageResults(
  league: League,
  stage: number,
  scope: DivisionScope,
): StageResultRow[] {
  return league.results
    .filter((r) => r.stage === stage && (scope === "all" ? true : r.div === scope))
    .sort((a, b) => a.div - b.div || a.place - b.place)
    .map((r) => {
      const p = league.players[r.playerIdx];
      return {
        place: r.place,
        date: r.date,
        playerIdx: r.playerIdx,
        rid: p.rid,
        name: p.name,
        initials: p.initials,
        color: p.color,
        div: r.div,
        matches: r.matches,
        wins: r.wonM,
        losses: r.lostM,
        games: r.games,
        gamesWon: r.wonG,
        gamesLost: r.lostG,
        balls: r.balls,
        ballsWon: r.wonB,
        ballsLost: r.lostB,
        court: r.court,
        rank: r.rank,
        points: r.points,
      };
    });
}

// --- Players overview (list screen) ---

export type PlayerOverview = {
  idx: number;
  rid: string;
  name: string;
  initials: string;
  color: string;
  skill: number;
  rank: number;
  divisions: number[];
  /** Per-division standing place (null if the player has no ranked result there). */
  divisionPlaces: { div: number; place: number | null }[];
  points: number;
  matches: number;
  winPct: number;
};

export function getPlayersOverview(league: League): PlayerOverview[] {
  const byIdx = new Map(getRatingRows(league, "all").map((r) => [r.playerIdx, r]));
  const placeByDiv: Record<1 | 2 | 3, Map<number, number>> = {
    1: new Map(getRatingRows(league, 1).map((r) => [r.playerIdx, r.place])),
    2: new Map(getRatingRows(league, 2).map((r) => [r.playerIdx, r.place])),
    3: new Map(getRatingRows(league, 3).map((r) => [r.playerIdx, r.place])),
  };
  return league.players
    .map((p) => {
      const r = byIdx.get(p.idx);
      return {
        idx: p.idx,
        rid: p.rid,
        name: p.name,
        initials: p.initials,
        color: p.color,
        skill: p.skill,
        rank: p.rank,
        divisions: p.divisions,
        divisionPlaces: p.divisions.map((d) => ({
          div: d,
          place: placeByDiv[d as 1 | 2 | 3]?.get(p.idx) ?? null,
        })),
        points: r?.points ?? 0,
        matches: r?.matches ?? 0,
        winPct: r?.winPct ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points);
}

// --- Player detail ---

export type PlayerHistoryRow = {
  stage: number;
  date: string;
  div: number;
  place: number;
  matches: number;
  wins: number;
  games: number;
  gamesWon: number;
  balls: number;
  ballsWon: number;
  court: number;
  rank: number;
  ratingBefore: number;
  ratingAfter: number;
  points: number;
};

export type PlayerDetail = {
  idx: number;
  name: string;
  rid: string;
  skill: number;
  rank: number;
  color: string;
  initials: string;
  divisions: number[];
  season: {
    matches: number;
    wins: number;
    winPct: number;
    games: number;
    gamesWon: number;
    gamesPct: number;
    balls: number;
    ballsWon: number;
    ballsPct: number;
    court: number;
    stages: number;
    points: number;
    best: number | null;
  };
  places: { p1: number; p2: number; p3: number; other: number; total: number };
  history: PlayerHistoryRow[];
};

export function getPlayerDetail(league: League, idx: number): PlayerDetail | null {
  const p = league.players[idx];
  if (!p) return null;
  const a = aggregate(league, idx);
  const rs = league.results
    .filter((r) => r.playerIdx === idx)
    .sort((x, y) => x.stage - y.stage || x.div - y.div);

  const places = { p1: 0, p2: 0, p3: 0, other: 0, total: rs.length };
  for (const r of rs) {
    if (r.place === 1) places.p1++;
    else if (r.place === 2) places.p2++;
    else if (r.place === 3) places.p3++;
    else places.other++;
  }

  return {
    idx: p.idx,
    name: p.name,
    rid: p.rid,
    skill: p.skill,
    rank: p.rank,
    color: p.color,
    initials: p.initials,
    divisions: p.divisions,
    season: {
      matches: a.matches,
      wins: a.wonM,
      winPct: a.matches ? Math.round((a.wonM / a.matches) * 100) : 0,
      games: a.games,
      gamesWon: a.wonG,
      gamesPct: a.games ? Math.round((a.wonG / a.games) * 100) : 0,
      balls: a.balls,
      ballsWon: a.wonB,
      ballsPct: a.balls ? Math.round((a.wonB / a.balls) * 100) : 0,
      court: a.court,
      stages: a.stages,
      points: a.points,
      best: a.best,
    },
    places,
    history: rs.map((r) => ({
      stage: r.stage,
      date: r.date,
      div: r.div,
      place: r.place,
      matches: r.matches,
      wins: r.wonM,
      games: r.games,
      gamesWon: r.wonG,
      balls: r.balls,
      ballsWon: r.wonB,
      court: r.court,
      rank: r.rank,
      ratingBefore: r.ratingBefore,
      ratingAfter: r.ratingAfter,
      points: r.points,
    })),
  };
}

// --- Head-to-head (Соперники) ---

export type OppMatch = {
  stage: number;
  div: number;
  date: string;
  gamesFor: number;
  gamesAgainst: number;
  won: boolean;
  /** per-game ball scores from the player's perspective */
  scoreDetail: { a: number; b: number }[];
  durationMin: number;
};

export type OpponentGroup = {
  oppIdx: number;
  name: string;
  initials: string;
  color: string;
  matches: number;
  wins: number;
  losses: number;
  winPct: number;
  list: OppMatch[];
};

/** The player's real head-to-head matches, grouped by opponent. */
export function getPlayerOpponents(league: League, playerIdx: number): OpponentGroup[] {
  if (!league.players[playerIdx]) return [];
  const dateByStage = new Map(league.stages.map((s) => [s.no, s.date]));
  const groups = new Map<number, OppMatch[]>();

  for (const mt of league.matches) {
    let oppIdx: number;
    let gamesFor: number;
    let gamesAgainst: number;
    let scoreDetail: { a: number; b: number }[];
    if (mt.aIdx === playerIdx) {
      oppIdx = mt.bIdx;
      gamesFor = mt.gamesA;
      gamesAgainst = mt.gamesB;
      scoreDetail = mt.detail;
    } else if (mt.bIdx === playerIdx) {
      oppIdx = mt.aIdx;
      gamesFor = mt.gamesB;
      gamesAgainst = mt.gamesA;
      scoreDetail = mt.detail.map((g) => ({ a: g.b, b: g.a }));
    } else {
      continue;
    }
    const list = groups.get(oppIdx) ?? [];
    list.push({
      stage: mt.stage,
      div: mt.division,
      date: dateByStage.get(mt.stage) ?? "",
      gamesFor,
      gamesAgainst,
      won: mt.winnerIdx === playerIdx,
      scoreDetail,
      durationMin: mt.durationMin,
    });
    groups.set(oppIdx, list);
  }

  const out: OpponentGroup[] = [];
  for (const [oppIdx, list] of groups) {
    list.sort((a, b) => b.stage - a.stage || a.div - b.div);
    const wins = list.filter((m) => m.won).length;
    const opp = league.players[oppIdx];
    out.push({
      oppIdx,
      name: opp.name,
      initials: opp.initials,
      color: opp.color,
      matches: list.length,
      wins,
      losses: list.length - wins,
      winPct: list.length ? Math.round((wins / list.length) * 100) : 0,
      list,
    });
  }
  out.sort((a, b) => b.matches - a.matches || b.winPct - a.winPct);
  return out;
}
