import type { RealMatch } from "@/lib/league";

/**
 * Match rating: the single most notable trait of a match, shown as a badge.
 * Priority: retirement > comeback (won after dropping the first two games) >
 * five games > tight (two+ games decided by <=2, or a long match of small
 * margins) > blowout (3:0 with wide margins) > plain competitive.
 *
 * `className` carries a tone-matched Tailwind pill style (border + bg + text).
 */
export type MatchRating = { label: string; className: string };

export function rateMatch(m: RealMatch): MatchRating {
  if (m.retired) return { label: "Отказ", className: "border-error/30 bg-error-container text-on-error-container" };
  const games = m.detail ?? [];
  const total = m.gamesA + m.gamesB;
  const winnerIsA = m.gamesA > m.gamesB;
  const gameWonByWinner = (g: { a: number; b: number }) => (winnerIsA ? g.a > g.b : g.b > g.a);
  const lostFirstTwo = games.length >= 2 && !gameWonByWinner(games[0]) && !gameWonByWinner(games[1]);
  const closeGames = games.filter((g) => Math.abs(g.a - g.b) <= 2).length;
  const avgMargin = games.length ? games.reduce((sum, g) => sum + Math.abs(g.a - g.b), 0) / games.length : 0;

  if (lostFirstTwo && total >= 4) return { label: "Камбэк", className: "border-primary/30 bg-primary/15 text-primary" };
  if (total === 5) return { label: "5 геймов", className: "border-[#ffa52a]/30 bg-[#ffa52a]/15 text-[#ffa52a]" };
  if (closeGames >= 2 || (total >= 4 && avgMargin <= 4)) return { label: "Плотный", className: "border-[#7eeaf5]/30 bg-[#7eeaf5]/15 text-[#7eeaf5]" };
  if (Math.min(m.gamesA, m.gamesB) === 0 && avgMargin >= 5) return { label: "Разгром", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant" };
  return { label: "Ровный", className: "border-outline-variant bg-surface-container-highest text-on-surface-variant" };
}

/** Priority weight of a rating label; higher = more notable for a "match of the stage" pick. */
const RATING_PRIORITY: Record<string, number> = {
  "Камбэк": 5,
  "5 геймов": 4,
  "Плотный": 3,
  "Ровный": 1,
  "Разгром": 0,
  "Отказ": -1,
};

/**
 * Numeric interest score for ranking matches. Primary term is the rating
 * priority; ties break toward more games played, then smaller average margins.
 */
export function matchInterestScore(m: RealMatch): number {
  const games = m.detail ?? [];
  const total = m.gamesA + m.gamesB;
  const avgMargin = games.length ? games.reduce((sum, g) => sum + Math.abs(g.a - g.b), 0) / games.length : 0;
  const priority = RATING_PRIORITY[rateMatch(m).label] ?? 0;
  return priority * 1000 + total * 10 + Math.max(0, 15 - avgMargin);
}

/** Form Index for a stage row: Match WR*0.45 + Game WR*0.35 + Rally WR*0.20. */
export function stageFormIndex(r: {
  matches: number;
  wins: number;
  games: number;
  gamesWon: number;
  balls: number;
  ballsWon: number;
}): number {
  const mwr = r.matches ? (r.wins / r.matches) * 100 : 0;
  const gwr = r.games ? (r.gamesWon / r.games) * 100 : 0;
  const rwr = r.balls ? (r.ballsWon / r.balls) * 100 : 0;
  return mwr * 0.45 + gwr * 0.35 + rwr * 0.2;
}

/** Form Index progress-bar color by value band. */
export function formIndexColor(value: number): string {
  if (value > 60) return "#22c55e";
  if (value >= 50) return "#f59e0b";
  if (value >= 40) return "#eab308";
  return "#ef4444";
}
