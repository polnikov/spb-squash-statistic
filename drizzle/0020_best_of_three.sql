-- Best-of-3 support: score distribution buckets for matches played to two wins.
-- The five-game / fifth-game columns keep their names but now mean "went to the
-- decider" (5th game in best-of-5, 3rd in best-of-3); a full backfill rewrites
-- their values.

ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "wins_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "wins_2_1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "losses_1_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "losses_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "player_opponent_stats" ADD COLUMN IF NOT EXISTS "h2h_wins_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN IF NOT EXISTS "h2h_wins_2_1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN IF NOT EXISTS "h2h_losses_1_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN IF NOT EXISTS "h2h_losses_0_2" integer DEFAULT 0 NOT NULL;
