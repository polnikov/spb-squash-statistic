CREATE TYPE "public"."player_stats_scope" AS ENUM('career', 'season', 'stage');--> statement-breakpoint
CREATE TABLE "match_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"game_number" smallint NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"player_a_score" smallint NOT NULL,
	"player_b_score" smallint NOT NULL,
	"winner_id" integer,
	"loser_id" integer,
	"duration_sec" integer,
	"point_margin" smallint DEFAULT 0 NOT NULL,
	"is_close_game" boolean DEFAULT false NOT NULL,
	"is_overtime_game" boolean DEFAULT false NOT NULL,
	"is_dominant_game" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_games_match_game_uq" UNIQUE("match_id","game_number")
);
--> statement-breakpoint
CREATE TABLE "player_stats_aggregate" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"scope" "player_stats_scope" NOT NULL,
	"season_id" integer,
	"stage_id" integer,
	"seasons_played" integer DEFAULT 0 NOT NULL,
	"stages_played" integer DEFAULT 0 NOT NULL,
	"matches_played" integer DEFAULT 0 NOT NULL,
	"matches_won" integer DEFAULT 0 NOT NULL,
	"matches_lost" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_won" integer DEFAULT 0 NOT NULL,
	"games_lost" integer DEFAULT 0 NOT NULL,
	"rallies_played" integer DEFAULT 0 NOT NULL,
	"rallies_won" integer DEFAULT 0 NOT NULL,
	"rallies_lost" integer DEFAULT 0 NOT NULL,
	"first_match_at" timestamp with time zone,
	"last_match_at" timestamp with time zone,
	"match_win_rate_pct" numeric(6, 3),
	"game_win_rate_pct" numeric(6, 3),
	"rally_win_rate_pct" numeric(6, 3),
	"game_balance" integer DEFAULT 0 NOT NULL,
	"rally_balance" integer DEFAULT 0 NOT NULL,
	"game_balance_per_match" numeric(8, 3),
	"rally_balance_per_match" numeric(8, 3),
	"wins_3_0" integer DEFAULT 0 NOT NULL,
	"wins_3_1" integer DEFAULT 0 NOT NULL,
	"wins_3_2" integer DEFAULT 0 NOT NULL,
	"losses_2_3" integer DEFAULT 0 NOT NULL,
	"losses_1_3" integer DEFAULT 0 NOT NULL,
	"losses_0_3" integer DEFAULT 0 NOT NULL,
	"clean_wins" integer DEFAULT 0 NOT NULL,
	"clean_losses" integer DEFAULT 0 NOT NULL,
	"clean_win_rate_pct" numeric(6, 3),
	"clean_loss_rate_pct" numeric(6, 3),
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "rankedin_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "admin_name" text;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_games" ADD CONSTRAINT "match_games_loser_id_players_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD CONSTRAINT "player_stats_aggregate_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD CONSTRAINT "player_stats_aggregate_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD CONSTRAINT "player_stats_aggregate_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_games_match_idx" ON "match_games" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_games_winner_idx" ON "match_games" USING btree ("winner_id");--> statement-breakpoint
CREATE INDEX "match_games_loser_idx" ON "match_games" USING btree ("loser_id");--> statement-breakpoint
CREATE UNIQUE INDEX "psa_career_uq" ON "player_stats_aggregate" USING btree ("player_id") WHERE "player_stats_aggregate"."scope" = 'career';--> statement-breakpoint
CREATE UNIQUE INDEX "psa_season_uq" ON "player_stats_aggregate" USING btree ("player_id","season_id") WHERE "player_stats_aggregate"."scope" = 'season';--> statement-breakpoint
CREATE UNIQUE INDEX "psa_stage_uq" ON "player_stats_aggregate" USING btree ("player_id","season_id","stage_id") WHERE "player_stats_aggregate"."scope" = 'stage';--> statement-breakpoint
CREATE INDEX "psa_player_idx" ON "player_stats_aggregate" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "psa_scope_idx" ON "player_stats_aggregate" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "psa_season_idx" ON "player_stats_aggregate" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "psa_stage_idx" ON "player_stats_aggregate" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "psa_player_scope_idx" ON "player_stats_aggregate" USING btree ("player_id","scope");--> statement-breakpoint
CREATE INDEX "psa_player_season_idx" ON "player_stats_aggregate" USING btree ("player_id","season_id");--> statement-breakpoint
CREATE INDEX "psa_calculated_at_idx" ON "player_stats_aggregate" USING btree ("calculated_at");