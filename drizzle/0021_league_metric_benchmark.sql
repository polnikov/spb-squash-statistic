-- League median benchmarks: one row per (scope, season, division, metric).
-- Partial unique indexes instead of a composite unique because season_id and
-- division are nullable and NULLs are distinct in Postgres (same pattern as
-- psa_*_uq). Values are filled by recalcBenchmarks, not by this migration.

CREATE TABLE IF NOT EXISTS "league_metric_benchmark" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" "player_stats_scope" NOT NULL,
	"season_id" integer,
	"division" smallint,
	"metric_key" text NOT NULL,
	"median" numeric(8, 3) NOT NULL,
	"qualified_players" integer NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "league_metric_benchmark" ADD CONSTRAINT "league_metric_benchmark_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "lmb_career_uq" ON "league_metric_benchmark" USING btree ("metric_key") WHERE "league_metric_benchmark"."scope" = 'career';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lmb_season_uq" ON "league_metric_benchmark" USING btree ("season_id","metric_key") WHERE "league_metric_benchmark"."scope" = 'season';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lmb_season_division_uq" ON "league_metric_benchmark" USING btree ("season_id","division","metric_key") WHERE "league_metric_benchmark"."scope" = 'season_division';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lmb_scope_idx" ON "league_metric_benchmark" USING btree ("scope");
