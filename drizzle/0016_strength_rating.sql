-- Strength Rating (Elo). Add rating columns + audit history, drop the old
-- calibrated 0-100 skillRating rating and its calibration table.

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strength_rating" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strength_rating_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strength_rating_peak" integer;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strength_rating_last_calculated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strength_rating_version" varchar(32);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "player_rating_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "player_id" integer NOT NULL,
  "match_id" integer NOT NULL,
  "rating_before" integer NOT NULL,
  "rating_after" integer NOT NULL,
  "delta" integer NOT NULL,
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "player_rating_history" ADD CONSTRAINT "player_rating_history_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_rating_history_player_match_idx" ON "player_rating_history" USING btree ("player_id","match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_rating_history_match_idx" ON "player_rating_history" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "players_strength_rating_idx" ON "players" USING btree ("strength_rating");--> statement-breakpoint

-- Remove the old calibrated 0-100 skillRating.
DROP INDEX IF EXISTS "psa_skill_rating_idx";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_reliability";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_k";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_calibration_version";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_reliability_status";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_level_status";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" DROP COLUMN IF EXISTS "skill_rating_calculated_at";--> statement-breakpoint
DROP TABLE IF EXISTS "career_skill_rating_calibration";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."skill_rating_reliability_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."skill_rating_level_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."skill_rating_k_source";
