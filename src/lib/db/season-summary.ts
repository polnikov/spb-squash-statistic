/**
 * Season-scoped Strength Rating movement, read from the per-match audit trail
 * (`player_rating_history`). Powers the manager's "Итоги сезона" tab: MVP by
 * current rating and "most improved" by the season delta.
 */

import { sql } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/lib/db";

export type SeasonStrengthRow = {
  /** RankedIn id used across the app (league players key). */
  rid: string;
  /** Career rating as of now (players.strength_rating). */
  rating: number | null;
  /** Career rated games (provisional below 10). */
  games: number;
  /** Rating before the first rated match of the season. */
  seasonStart: number;
  /** Rating after the last rated match of the season. */
  seasonEnd: number;
  /** seasonEnd - seasonStart. */
  seasonDelta: number;
  /** Rated matches inside the season. */
  seasonGames: number;
};

/** Per-player Strength Rating summary for one season, keyed by rid. */
export async function loadSeasonStrengthSummary(
  season: string,
  database: Database = defaultDb,
): Promise<Map<string, SeasonStrengthRow>> {
  // History ids grow with the global chronological recompute, so min/max id
  // bound the season window per player.
  const rows = await database.execute(sql`
    select
      p.rankedin_id as rid,
      p.strength_rating as rating,
      p.strength_rating_games as games,
      (array_agg(ph.rating_before order by ph.id asc))[1] as season_start,
      (array_agg(ph.rating_after order by ph.id desc))[1] as season_end,
      count(*)::int as season_games
    from player_rating_history ph
    join matches m on m.id = ph.match_id
    join stages s on s.id = m.stage_id
    join seasons se on se.id = s.season_id
    join players p on p.id = ph.player_id
    where se.label = ${season} and p.rankedin_id is not null
    group by p.id
  `);

  const out = new Map<string, SeasonStrengthRow>();
  for (const r of rows as unknown as Array<Record<string, unknown>>) {
    const rid = String(r.rid);
    const seasonStart = Number(r.season_start);
    const seasonEnd = Number(r.season_end);
    out.set(rid, {
      rid,
      rating: r.rating == null ? null : Number(r.rating),
      games: Number(r.games ?? 0),
      seasonStart,
      seasonEnd,
      seasonDelta: seasonEnd - seasonStart,
      seasonGames: Number(r.season_games ?? 0),
    });
  }
  return out;
}
