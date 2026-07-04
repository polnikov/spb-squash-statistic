DO $$ BEGIN
	CREATE TYPE "public"."skill_index_status" AS ENUM('beginner', 'developing', 'competitive', 'strong', 'elite');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TYPE "public"."metric_key" ADD VALUE IF NOT EXISTS 'skillIndex';--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_index" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_index_status" "skill_index_status";
