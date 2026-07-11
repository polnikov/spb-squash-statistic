/**
 * Strength Rating (Elo) — opponent-aware, cross-division player strength.
 *
 * The pure core (`expectedScore` / `kFactor` / `scoreFactor` / `marginFactor` /
 * `applyMatch`) has no I/O and is fully deterministic. `recomputeStrengthRatings`
 * folds the whole match history left-to-right in canonical order and writes the
 * cached columns on `players` plus the `player_rating_history` audit trail.
 *
 * Squash adaptation (best-of-5): the base score S is a binary win/loss (Elo
 * core); the bo5 structure enters only as magnitude multipliers — `scoreFactor`
 * (games won by the loser) and `marginFactor` (rally margin) — so the
 * probabilistic core stays intact while decisiveness is rewarded.
 */

import { eq } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";
import { matches, players, playerRatingHistory, seasons, stages, type NewPlayerRatingHistory } from "@/lib/db/schema";
import { seasonStart } from "@/lib/league";

export const STRENGTH_RATING = {
  base: 1500,
  min: 800,
  provisionalGames: 10,
  version: "strength-rating-v1",
} as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Logistic (Bradley–Terry) win probability of A over B. Scale 400. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** Dynamic K: high for provisional players, low for established ones. */
export function kFactor(games: number): number {
  if (games < 10) return 40;
  if (games < 50) return 24;
  if (games < 150) return 20;
  return 16;
}

/** Decisiveness by games won by the loser: 0 → 1.15, 1 → 1.08, 2 → 1.00. */
export function scoreFactor(loserGames: number): number {
  if (loserGames <= 0) return 1.15;
  if (loserGames === 1) return 1.08;
  return 1.0;
}

/**
 * Rally-margin amplifier from the winner's perspective (always >= 0), shared by
 * both players. Clamped 1.00–1.10. Winner-based (not per-player) so a blowout
 * loss never costs less than a close one.
 */
export function marginFactor(winnerRallies: number, loserRallies: number): number {
  return clamp(1 + (winnerRallies - loserRallies) / 120, 1.0, 1.1);
}

/** True while the player is still provisional (fewer than 10 completed games). */
export function isProvisional(games: number): boolean {
  return games < STRENGTH_RATING.provisionalGames;
}

export type StrengthMatch = {
  matchId: number;
  playerAId: number;
  playerBId: number;
  winnerIsA: boolean;
  /** Games won by the losing player (0, 1 or 2). */
  loserGames: number;
  winnerRallies: number;
  loserRallies: number;
};

export type RatingState = { rating: number; games: number; peak: number };

type PlayerDelta = { playerId: number; before: number; after: number; delta: number };
export type MatchRatingResult = { a: PlayerDelta; b: PlayerDelta };

function stateOf(map: Map<number, RatingState>, playerId: number): RatingState {
  return map.get(playerId) ?? { rating: STRENGTH_RATING.base, games: 0, peak: STRENGTH_RATING.base };
}

/**
 * Apply one match to the mutable rating state and return each player's
 * before/after/delta. delta = K·(S−E)·scoreFactor·marginFactor; the new rating
 * is `round(before + delta)` floored at MIN_RATING (spec §9).
 */
export function applyMatch(state: Map<number, RatingState>, m: StrengthMatch): MatchRatingResult {
  const a = stateOf(state, m.playerAId);
  const b = stateOf(state, m.playerBId);

  const eA = expectedScore(a.rating, b.rating);
  const eB = 1 - eA;
  const sA = m.winnerIsA ? 1 : 0;
  const sB = 1 - sA;
  const sf = scoreFactor(m.loserGames);
  const mf = marginFactor(m.winnerRallies, m.loserRallies);

  const rawA = kFactor(a.games) * (sA - eA) * sf * mf;
  const rawB = kFactor(b.games) * (sB - eB) * sf * mf;
  const afterA = Math.max(STRENGTH_RATING.min, Math.round(a.rating + rawA));
  const afterB = Math.max(STRENGTH_RATING.min, Math.round(b.rating + rawB));

  state.set(m.playerAId, { rating: afterA, games: a.games + 1, peak: Math.max(a.peak, afterA) });
  state.set(m.playerBId, { rating: afterB, games: b.games + 1, peak: Math.max(b.peak, afterB) });

  return {
    a: { playerId: m.playerAId, before: a.rating, after: afterA, delta: afterA - a.rating },
    b: { playerId: m.playerBId, before: b.rating, after: afterB, delta: afterB - b.rating },
  };
}

type OrderedMatchRow = {
  id: number;
  playerAId: number;
  playerBId: number;
  gamesA: number;
  gamesB: number;
  winnerId: number | null;
  scoreDetail: { a: number; b: number }[] | null;
  stageNumber: number;
  seasonLabel: string;
};

/** Canonical deterministic order: season year → stage number → match id (§11). */
function orderMatches(rows: OrderedMatchRow[]): OrderedMatchRow[] {
  return [...rows].sort(
    (x, y) =>
      seasonStart(x.seasonLabel) - seasonStart(y.seasonLabel) ||
      x.stageNumber - y.stageNumber ||
      x.id - y.id,
  );
}

function toStrengthMatch(r: OrderedMatchRow): StrengthMatch | null {
  if (r.winnerId == null) return null;
  const winnerIsA = r.winnerId === r.playerAId;
  const loserGames = winnerIsA ? r.gamesB : r.gamesA;
  let aRallies = 0;
  let bRallies = 0;
  for (const g of r.scoreDetail ?? []) {
    aRallies += g.a;
    bRallies += g.b;
  }
  return {
    matchId: r.id,
    playerAId: r.playerAId,
    playerBId: r.playerBId,
    winnerIsA,
    loserGames,
    winnerRallies: winnerIsA ? aRallies : bRallies,
    loserRallies: winnerIsA ? bRallies : aRallies,
  };
}

/**
 * Global chronological rebuild. Deterministic: pure function of the ordered
 * match list. Replaces `players.strength_rating*` and `player_rating_history`
 * in one transaction. Players with no matches keep a null rating.
 */
export async function recomputeStrengthRatings(
  database: Database = defaultDb,
): Promise<{ players: number; matches: number }> {
  const rows = (await database
    .select({
      id: matches.id,
      playerAId: matches.playerAId,
      playerBId: matches.playerBId,
      gamesA: matches.gamesA,
      gamesB: matches.gamesB,
      winnerId: matches.winnerId,
      scoreDetail: matches.scoreDetail,
      stageNumber: stages.number,
      seasonLabel: seasons.label,
    })
    .from(matches)
    .innerJoin(stages, eq(matches.stageId, stages.id))
    .innerJoin(seasons, eq(stages.seasonId, seasons.id))) as OrderedMatchRow[];

  const ordered = orderMatches(rows);
  const state = new Map<number, RatingState>();
  const history: NewPlayerRatingHistory[] = [];
  const now = new Date();

  for (const row of ordered) {
    const m = toStrengthMatch(row);
    if (!m) continue;
    const res = applyMatch(state, m);
    for (const side of [res.a, res.b]) {
      history.push({
        playerId: side.playerId,
        matchId: row.id,
        ratingBefore: side.before,
        ratingAfter: side.after,
        delta: side.delta,
        calculatedAt: now,
      });
    }
  }

  await database.transaction(async (tx) => {
    await tx.delete(playerRatingHistory);
    for (let i = 0; i < history.length; i += 1000) {
      await tx.insert(playerRatingHistory).values(history.slice(i, i + 1000));
    }
    // Reset every player, then write the computed rows — removed matches clear
    // stale ratings and players without matches stay null.
    await tx.update(players).set({
      strengthRating: null,
      strengthRatingGames: 0,
      strengthRatingPeak: null,
      strengthRatingLastCalculatedAt: now,
      strengthRatingVersion: STRENGTH_RATING.version,
    });
    for (const [playerId, s] of state) {
      await tx
        .update(players)
        .set({
          strengthRating: s.rating,
          strengthRatingGames: s.games,
          strengthRatingPeak: s.peak,
          strengthRatingLastCalculatedAt: now,
          strengthRatingVersion: STRENGTH_RATING.version,
        })
        .where(eq(players.id, playerId));
    }
  });

  return { players: state.size, matches: history.length / 2 };
}
