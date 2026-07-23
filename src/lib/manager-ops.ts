import { TOTAL_STAGES, type League } from "@/lib/league";
import { isFakeRankedinId, isLiveRankedinId } from "@/lib/rankedin-id";

/**
 * Manager operations dashboard: everything a tournament admin needs to keep the
 * season on track. Pure over the loaded league; upload audit and the duplicates
 * count come from server actions, not from here.
 */

export type OpsDivisionStatus = {
  division: number;
  players: number;
  played: number;
  remaining: number;
  /** First unplayed stage number, or null when the division is complete. */
  nextStage: number | null;
  /** Scheduled date of the next stage, if the calendar has one. */
  nextDate: string | null;
  /** Next stage is scheduled and its date has passed but it is not loaded. */
  nextOverdue: boolean;
  /** Data-quality tallies scoped to this division. */
  missingCount: number;
  noScoreCount: number;
  noTimeCount: number;
  noIdCount: number;
};

export type OpsCalendarRow = {
  stage: number;
  /** Scheduled (season) date for the stage. */
  date: string | null;
  /** Per-division loaded flags. */
  loaded: Record<number, boolean>;
  /** Date passed and at least one division has not loaded it. */
  overdue: boolean;
};

export type OpsBadMatch = {
  division: number;
  stage: number;
  a: string;
  b: string;
  noScore: boolean;
  noTime: boolean;
};

export type OpsPlayerNoId = { rid: string; name: string; kind: "fake" | "deleted" | "empty"; divisions: number[] };

export type ManagerOps = {
  season: string;
  totalStages: number;
  divisions: OpsDivisionStatus[];
  calendar: OpsCalendarRow[];
  /** Division-stage cells that are due (date passed) but not loaded. */
  missing: { division: number; stage: number; date: string | null }[];
  badMatches: OpsBadMatch[];
  noScoreCount: number;
  noTimeCount: number;
  playersNoId: OpsPlayerNoId[];
};

/** Distinct stage numbers with loaded results for a division. */
function playedStages(league: League, division: number): Set<number> {
  const out = new Set<number>();
  for (const r of league.results) if (r.div === division) out.add(r.stage);
  return out;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function buildManagerOps(league: League): ManagerOps {
  const today = todayIso();
  // Divisions the season actually uses: any that has a roster or a result.
  const divisionSet = new Set<number>();
  for (const key of Object.keys(league.rosters)) divisionSet.add(Number(key));
  for (const r of league.results) divisionSet.add(r.div);
  const divisions = [...divisionSet].filter((d) => d > 0).sort((a, b) => a - b);

  // Scheduled date per stage number (season-level calendar).
  const dateByStage = new Map<number, string | null>();
  for (const s of league.stages) dateByStage.set(s.no, s.date || null);

  const playedByDiv = new Map<number, Set<number>>(divisions.map((d) => [d, playedStages(league, d)]));

  // Per-division data-quality tallies, filled by the passes below.
  const zero = () => new Map<number, number>(divisions.map((d) => [d, 0]));
  const missingByDiv = zero();
  const noScoreByDiv = zero();
  const noTimeByDiv = zero();
  const noIdByDiv = zero();
  const bump = (map: Map<number, number>, div: number) => map.set(div, (map.get(div) ?? 0) + 1);

  const missing: ManagerOps["missing"] = [];
  const calendar: OpsCalendarRow[] = [];
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    const date = dateByStage.get(stage) ?? null;
    const loaded: Record<number, boolean> = {};
    let overdue = false;
    for (const division of divisions) {
      const isLoaded = playedByDiv.get(division)?.has(stage) ?? false;
      loaded[division] = isLoaded;
      if (!isLoaded && date && date < today) {
        overdue = true;
        missing.push({ division, stage, date });
        bump(missingByDiv, division);
      }
    }
    // Skip trailing stages that have neither a date nor any loaded division.
    const anyLoaded = divisions.some((d) => loaded[d]);
    if (date || anyLoaded) calendar.push({ stage, date, loaded, overdue });
  }

  // Match completeness. Sample list is capped; per-division counts are exact.
  const playerName = (idx: number) => league.players[idx]?.name ?? "?";
  const badMatches: OpsBadMatch[] = [];
  let noScoreCount = 0;
  let noTimeCount = 0;
  for (const m of league.matches) {
    const noScore = (m.detail?.length ?? 0) === 0 && !m.retired;
    const noTime = !m.durationMin || m.durationMin <= 0;
    if (noScore) {
      noScoreCount++;
      bump(noScoreByDiv, m.division);
    }
    if (noTime) {
      noTimeCount++;
      bump(noTimeByDiv, m.division);
    }
    if ((noScore || noTime) && badMatches.length < 200) {
      badMatches.push({ division: m.division, stage: m.stage, a: playerName(m.aIdx), b: playerName(m.bIdx), noScore, noTime });
    }
  }

  const playersNoId: OpsPlayerNoId[] = [];
  for (const p of league.players) {
    const rid = (p.rid ?? "").trim();
    if (isLiveRankedinId(rid)) continue;
    const kind: OpsPlayerNoId["kind"] = !rid ? "empty" : isFakeRankedinId(rid) ? "fake" : "deleted";
    const divs = (p.divisions ?? []).filter((d) => divisions.includes(d));
    playersNoId.push({ rid, name: p.name, kind, divisions: divs });
    for (const d of divs) bump(noIdByDiv, d);
  }

  const divisionStatus: OpsDivisionStatus[] = divisions.map((division) => {
    const played = playedByDiv.get(division) ?? new Set<number>();
    let nextStage: number | null = null;
    for (let n = 1; n <= TOTAL_STAGES; n++) {
      if (!played.has(n)) {
        nextStage = n;
        break;
      }
    }
    const nextDate = nextStage != null ? dateByStage.get(nextStage) ?? null : null;
    return {
      division,
      players: league.rosters[division]?.length ?? 0,
      played: played.size,
      remaining: Math.max(0, TOTAL_STAGES - played.size),
      nextStage,
      nextDate,
      nextOverdue: Boolean(nextDate && nextDate < today),
      missingCount: missingByDiv.get(division) ?? 0,
      noScoreCount: noScoreByDiv.get(division) ?? 0,
      noTimeCount: noTimeByDiv.get(division) ?? 0,
      noIdCount: noIdByDiv.get(division) ?? 0,
    };
  });

  return {
    season: league.season,
    totalStages: TOTAL_STAGES,
    divisions: divisionStatus,
    calendar,
    missing,
    badMatches,
    noScoreCount,
    noTimeCount,
    playersNoId,
  };
}
