/**
 * One-off: backfill match_games from matches.scoreDetail and recompute every
 * player's aggregates. Run after applying the stats migration:
 *
 *   npm run db:migrate
 *   npx tsx src/scripts/backfill-stats.ts
 */

import { backfillAll } from "@/lib/stats/recalc";

async function main() {
  const res = await backfillAll();
  console.log(
    `matches=${res.matchesProcessed} games=${res.gamesInserted} players=${res.playersRecalculated}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
