import {
  getRatingRowsThroughStage,
  getStageResults,
  type League,
  type RealMatch,
} from "@/lib/league";
import { fmtCourt, fmtDate, matchesLabel, pluralRu } from "@/lib/format";
import { matchInterestScore, rateMatch, stageFormIndex, type MatchRating } from "@/lib/stats/match-rating";

export type DigestPlayer = { name: string; rid: string };

export type DigestMatch = {
  a: DigestPlayer;
  b: DigestPlayer;
  winner: DigestPlayer;
  loser: DigestPlayer;
  /** Games won by the winner and by the loser, e.g. 3:2. */
  winnerGames: number;
  loserGames: number;
  durationMin: number;
  retired: boolean;
  rating: MatchRating;
};

export type DigestPodiumRow = { place: number; name: string; rid: string; wins: number; losses: number; points: number };
export type DigestMover = { name: string; rid: string; place: number; delta: number };
export type DigestSweep = { name: string; rid: string; wins: number };
export type DigestForm = { name: string; rid: string; form: number; wins: number; losses: number };

export type StageDigest = {
  division: number;
  stage: number;
  date: string | null;
  hasData: boolean;
  metrics: {
    players: number;
    matches: number;
    totalTime: number;
    avgTime: number;
    fiveGame: number;
    longestTime: number;
  };
  winner: DigestPodiumRow | null;
  podium: DigestPodiumRow[];
  climber: DigestMover | null;
  faller: DigestMover | null;
  matchOfStage: DigestMatch | null;
  longestMatch: DigestMatch | null;
  sweeps: DigestSweep[];
  bestForm: DigestForm | null;
  retirements: DigestMatch[];
};

function toDigestMatch(league: League, m: RealMatch): DigestMatch {
  const pa = league.players[m.aIdx];
  const pb = league.players[m.bIdx];
  const a: DigestPlayer = { name: pa?.name ?? "?", rid: pa?.rid ?? "" };
  const b: DigestPlayer = { name: pb?.name ?? "?", rid: pb?.rid ?? "" };
  const winnerIsA = m.gamesA > m.gamesB;
  return {
    a,
    b,
    winner: winnerIsA ? a : b,
    loser: winnerIsA ? b : a,
    winnerGames: Math.max(m.gamesA, m.gamesB),
    loserGames: Math.min(m.gamesA, m.gamesB),
    durationMin: m.durationMin,
    retired: Boolean(m.retired),
    rating: rateMatch(m),
  };
}

/** Build the highlight facts for a single (division, stage) from the loaded league. */
export function buildStageDigest(league: League, division: 1 | 2 | 3, stage: number): StageDigest {
  const rows = getStageResults(league, stage, division);
  const matches = league.matches.filter((m) => m.stage === stage && m.division === division);

  const empty: StageDigest = {
    division,
    stage,
    date: rows[0]?.date ?? null,
    hasData: rows.length > 0,
    metrics: { players: 0, matches: 0, totalTime: 0, avgTime: 0, fiveGame: 0, longestTime: 0 },
    winner: null,
    podium: [],
    climber: null,
    faller: null,
    matchOfStage: null,
    longestMatch: null,
    sweeps: [],
    bestForm: null,
    retirements: [],
  };
  if (rows.length === 0) return empty;

  const totalTime = matches.reduce((sum, m) => sum + m.durationMin, 0);
  const metrics = {
    players: rows.length,
    matches: matches.length,
    totalTime,
    avgTime: matches.length ? Math.round(totalTime / matches.length) : 0,
    fiveGame: matches.filter((m) => m.gamesA + m.gamesB === 5).length,
    longestTime: matches.reduce((max, m) => Math.max(max, m.durationMin), 0),
  };

  const podium: DigestPodiumRow[] = rows.slice(0, 3).map((r) => ({
    place: r.place,
    name: r.name,
    rid: r.rid,
    wins: r.wins,
    losses: r.losses,
    points: r.points,
  }));
  const winner = podium[0] ?? null;

  // Cumulative division standing move after this stage (empty for stage 1 / no delta).
  const standings = getRatingRowsThroughStage(league, division, stage);
  const climberRow = standings.reduce<(typeof standings)[number] | null>((best, r) => (best == null || r.positionDelta > best.positionDelta ? r : best), null);
  const fallerRow = standings.reduce<(typeof standings)[number] | null>((worst, r) => (worst == null || r.positionDelta < worst.positionDelta ? r : worst), null);
  const climber = climberRow && climberRow.positionDelta > 0 ? { name: climberRow.name, rid: climberRow.rid, place: climberRow.place, delta: climberRow.positionDelta } : null;
  const faller = fallerRow && fallerRow.positionDelta < 0 ? { name: fallerRow.name, rid: fallerRow.rid, place: fallerRow.place, delta: fallerRow.positionDelta } : null;

  const decided = matches.filter((m) => !m.retired);
  const matchOfStage = decided.length
    ? toDigestMatch(league, decided.reduce((best, m) => (matchInterestScore(m) > matchInterestScore(best) ? m : best)))
    : null;
  const longestMatch = matches.length
    ? toDigestMatch(league, matches.reduce((best, m) => (m.durationMin > best.durationMin ? m : best)))
    : null;

  // Clean sweeps: played 2+ matches, lost none.
  const sweeps: DigestSweep[] = rows
    .filter((r) => r.matches >= 2 && r.losses === 0)
    .map((r) => ({ name: r.name, rid: r.rid, wins: r.wins }));

  const formCandidates = rows.filter((r) => r.matches >= 2);
  const bestFormRow = formCandidates.reduce<(typeof formCandidates)[number] | null>(
    (best, r) => (best == null || stageFormIndex(r) > stageFormIndex(best) ? r : best),
    null,
  );
  const bestForm = bestFormRow
    ? { name: bestFormRow.name, rid: bestFormRow.rid, form: stageFormIndex(bestFormRow), wins: bestFormRow.wins, losses: bestFormRow.losses }
    : null;

  const retirements = matches.filter((m) => m.retired).map((m) => toDigestMatch(league, m));

  return {
    division,
    stage,
    date: rows[0]?.date ?? null,
    hasData: true,
    metrics,
    winner,
    podium,
    climber,
    faller,
    matchOfStage,
    longestMatch,
    sweeps,
    bestForm,
    retirements,
  };
}

/** Ready-to-copy social caption assembled from the digest facts. */
export function stageDigestCaption(d: StageDigest): string {
  if (!d.hasData) return "";
  const lines: string[] = [];
  const header = `Дивизион ${d.division} - Этап ${d.stage}${d.date ? ` (${fmtDate(d.date)})` : ""}`;
  lines.push(header, "");

  if (d.winner) {
    lines.push(`Победитель этапа: ${d.winner.name} (${d.winner.wins}-${d.winner.losses}, ${d.winner.points} очк.)`);
  }
  if (d.podium.length > 1) {
    lines.push(`Топ-3: ${d.podium.map((p) => `${p.place}. ${p.name}`).join(" · ")}`);
  }
  if (d.climber || d.faller) {
    lines.push("");
    if (d.climber) lines.push(`Взлёт этапа: ${d.climber.name} +${d.climber.delta} (теперь ${d.climber.place}-й)`);
    if (d.faller) lines.push(`Падение: ${d.faller.name} ${d.faller.delta} (теперь ${d.faller.place}-й)`);
  }

  lines.push("");
  if (d.matchOfStage) {
    const m = d.matchOfStage;
    lines.push(`Матч этапа [${m.rating.label}]: ${m.winner.name} - ${m.loser.name} ${m.winnerGames}:${m.loserGames}`);
  }
  if (d.longestMatch) {
    const m = d.longestMatch;
    lines.push(`Самый длинный матч: ${m.a.name} - ${m.b.name} (${fmtCourt(m.durationMin)})`);
  }
  if (d.sweeps.length) {
    lines.push(`Сухая победа: ${d.sweeps.map((s) => `${s.name} (${s.wins}-0)`).join(", ")}`);
  }
  if (d.bestForm) {
    lines.push(`Лучшая форма: ${d.bestForm.name} (${d.bestForm.form.toFixed(1)})`);
  }
  if (d.retirements.length) {
    lines.push(`Отказы: ${[...new Set(d.retirements.map((m) => m.loser.name))].join(", ")}`);
  }

  lines.push("");
  const fiveWord = pluralRu(d.metrics.fiveGame, ["пятигеймовый", "пятигеймовых", "пятигеймовых"]);
  lines.push(
    `Цифры этапа: ${matchesLabel(d.metrics.matches)} · ${fmtCourt(d.metrics.totalTime)} на корте · ${d.metrics.fiveGame} ${fiveWord} · среднее ${fmtCourt(d.metrics.avgTime)}`,
  );

  return lines.join("\n");
}
