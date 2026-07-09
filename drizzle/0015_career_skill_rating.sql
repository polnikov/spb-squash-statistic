DO $$ BEGIN
  CREATE TYPE "public"."skill_rating_reliability_status" AS ENUM('insufficient', 'provisional', 'eligible');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."skill_rating_level_status" AS ENUM('below_level', 'developing', 'competitive', 'good', 'strong', 'very_strong', 'dominant');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."skill_rating_k_source" AS ENUM('empirical', 'previous', 'default');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "career_skill_rating_calibration" (
  "id" serial PRIMARY KEY NOT NULL,
  "version" integer NOT NULL,
  "adaptive_k" integer NOT NULL,
  "raw_optimal_k" integer,
  "baseline" numeric(6, 3) DEFAULT '50.000' NOT NULL,
  "k_source" "skill_rating_k_source" NOT NULL,
  "calibration_players_count" integer DEFAULT 0 NOT NULL,
  "calibration_matches_count" integer DEFAULT 0 NOT NULL,
  "weighted_mse" numeric(12, 6),
  "calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "algorithm_version" text NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "career_skill_rating_calibration_version_unique" UNIQUE("version")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "career_skill_rating_calibration_active_uq" ON "career_skill_rating_calibration" USING btree ("is_active") WHERE "career_skill_rating_calibration"."is_active" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "career_skill_rating_calibration_version_idx" ON "career_skill_rating_calibration" USING btree ("version");--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_reliability" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_k" integer;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_calibration_version" integer;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_reliability_status" "skill_rating_reliability_status";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_level_status" "skill_rating_level_status";--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_rating_calculated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "psa_skill_rating_idx" ON "player_stats_aggregate" USING btree ("skill_rating", "matches_played");--> statement-breakpoint
INSERT INTO "career_skill_rating_calibration" (
  "version",
  "adaptive_k",
  "raw_optimal_k",
  "baseline",
  "k_source",
  "calibration_players_count",
  "calibration_matches_count",
  "weighted_mse",
  "algorithm_version",
  "is_active"
)
SELECT
  1,
  10,
  NULL,
  50.000,
  'default'::"skill_rating_k_source",
  0,
  0,
  NULL,
  'career-skill-rating-v1',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM "career_skill_rating_calibration" WHERE "is_active" = true
);--> statement-breakpoint
UPDATE "player_stats_aggregate"
SET
  "skill_rating_k" = active."adaptive_k",
  "skill_rating_calibration_version" = active."version",
  "skill_rating_reliability" = CASE
    WHEN "skill_index" IS NULL OR "matches_played" <= 0 OR active."adaptive_k" <= 0 THEN NULL
    ELSE ROUND(("matches_played"::numeric / ("matches_played" + active."adaptive_k"))::numeric, 3)
  END,
  "skill_rating" = CASE
    WHEN "skill_index" IS NULL OR "matches_played" <= 0 OR active."adaptive_k" <= 0 THEN NULL
    ELSE ROUND(
      LEAST(
        100,
        GREATEST(
          0,
          active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k"))
        )
      ),
      1
    )
  END,
  "skill_rating_reliability_status" = CASE
    WHEN "matches_played" < 3 THEN 'insufficient'
    WHEN "matches_played" < 6 THEN 'provisional'
    ELSE 'eligible'
  END::"skill_rating_reliability_status",
  "skill_rating_level_status" = (
    CASE
      WHEN "skill_index" IS NULL OR "matches_played" <= 0 OR active."adaptive_k" <= 0 THEN NULL
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 45 THEN 'below_level'
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 50 THEN 'developing'
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 55 THEN 'competitive'
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 60 THEN 'good'
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 67 THEN 'strong'
      WHEN ROUND(LEAST(100, GREATEST(0, active."baseline" + ("skill_index" - active."baseline") * ("matches_played"::numeric / ("matches_played" + active."adaptive_k")))), 1) < 72 THEN 'very_strong'
      ELSE 'dominant'
    END
  )::"skill_rating_level_status",
  "skill_rating_calculated_at" = now()
FROM (
  SELECT "version", "adaptive_k", "baseline"
  FROM "career_skill_rating_calibration"
  WHERE "is_active" = true
  ORDER BY "version" DESC
  LIMIT 1
) active
WHERE "scope" = 'career';
