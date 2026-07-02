CREATE TYPE "public"."metric_key" AS ENUM('matchWinRatePct', 'gameWinRatePct', 'rallyWinRatePct', 'formIndex', 'gameBalancePerMatch', 'rallyBalancePerMatch', 'cumulativeGameBalance', 'cumulativeRallyBalance', 'matchesPlayed');--> statement-breakpoint
CREATE TABLE "player_metric_series_point" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"metric_key" "metric_key" NOT NULL,
	"season_id" integer,
	"stage_id" integer,
	"order_index" integer NOT NULL,
	"label" text NOT NULL,
	"value" numeric(12, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pmsp_uq" UNIQUE("player_id","metric_key","season_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_games_won_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_games_lost_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_games_played_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_rallies_won_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_rallies_lost_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_rallies_played_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_rally_margin_per_game" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_match_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_game_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_rally_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "stats_reliability_score" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_games_won_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_games_lost_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_games_played_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_rallies_won_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_rallies_lost_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_rallies_played_per_match" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_match_games_won" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_match_games_lost" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_rally_margin_per_game" numeric(8, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "current_win_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "current_loss_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "longest_win_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "longest_loss_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_matches_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_matches_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_matches_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_match_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last5_rally_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_matches_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_matches_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_matches_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_match_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "last10_rally_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "match_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "game_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "rally_win_rate_trend_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "form_index_trend" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "cumulative_game_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "cumulative_rally_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "stats_reliability_score" numeric(4, 3);--> statement-breakpoint
ALTER TABLE "player_metric_series_point" ADD CONSTRAINT "player_metric_series_point_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_metric_series_point" ADD CONSTRAINT "player_metric_series_point_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_metric_series_point" ADD CONSTRAINT "player_metric_series_point_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pmsp_player_idx" ON "player_metric_series_point" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "pmsp_player_metric_idx" ON "player_metric_series_point" USING btree ("player_id","metric_key");--> statement-breakpoint
CREATE INDEX "pmsp_player_season_idx" ON "player_metric_series_point" USING btree ("player_id","season_id");