CREATE TYPE "public"."skill_index_status" AS ENUM('beginner', 'developing', 'competitive', 'strong', 'elite');--> statement-breakpoint
ALTER TYPE "public"."metric_key" ADD VALUE IF NOT EXISTS 'skillIndex';--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "skill_index" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "skill_index_status" "skill_index_status";
