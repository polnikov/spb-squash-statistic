CREATE TYPE "public"."matchup_status" AS ENUM('very_comfortable', 'comfortable', 'equal', 'uncomfortable', 'very_uncomfortable', 'not_enough_data');--> statement-breakpoint
CREATE TYPE "public"."sample_size_level" AS ENUM('very_low', 'low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "player_opponent_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"opponent_id" integer NOT NULL,
	"meetings_played" integer DEFAULT 0 NOT NULL,
	"first_meeting_at" timestamp with time zone,
	"last_meeting_at" timestamp with time zone,
	"h2h_matches_won" integer DEFAULT 0 NOT NULL,
	"h2h_matches_lost" integer DEFAULT 0 NOT NULL,
	"h2h_match_win_rate_pct" numeric(6, 3),
	"h2h_games_played" integer DEFAULT 0 NOT NULL,
	"h2h_games_won" integer DEFAULT 0 NOT NULL,
	"h2h_games_lost" integer DEFAULT 0 NOT NULL,
	"h2h_game_win_rate_pct" numeric(6, 3),
	"h2h_game_balance" integer DEFAULT 0 NOT NULL,
	"h2h_game_balance_per_match" numeric(8, 3),
	"h2h_rallies_played" integer DEFAULT 0 NOT NULL,
	"h2h_rallies_won" integer DEFAULT 0 NOT NULL,
	"h2h_rallies_lost" integer DEFAULT 0 NOT NULL,
	"h2h_rally_win_rate_pct" numeric(6, 3),
	"h2h_rally_balance" integer DEFAULT 0 NOT NULL,
	"h2h_rally_balance_per_match" numeric(8, 3),
	"h2h_wins_3_0" integer DEFAULT 0 NOT NULL,
	"h2h_wins_3_1" integer DEFAULT 0 NOT NULL,
	"h2h_wins_3_2" integer DEFAULT 0 NOT NULL,
	"h2h_losses_2_3" integer DEFAULT 0 NOT NULL,
	"h2h_losses_1_3" integer DEFAULT 0 NOT NULL,
	"h2h_losses_0_3" integer DEFAULT 0 NOT NULL,
	"h2h_clean_wins" integer DEFAULT 0 NOT NULL,
	"h2h_clean_losses" integer DEFAULT 0 NOT NULL,
	"h2h_five_game_matches" integer DEFAULT 0 NOT NULL,
	"h2h_five_game_matches_won" integer DEFAULT 0 NOT NULL,
	"h2h_five_game_matches_lost" integer DEFAULT 0 NOT NULL,
	"h2h_five_game_win_rate_pct" numeric(6, 3),
	"h2h_close_games_won" integer DEFAULT 0 NOT NULL,
	"h2h_close_games_lost" integer DEFAULT 0 NOT NULL,
	"h2h_close_game_win_rate_pct" numeric(6, 3),
	"h2h_overtime_games_won" integer DEFAULT 0 NOT NULL,
	"h2h_overtime_games_lost" integer DEFAULT 0 NOT NULL,
	"h2h_dominant_games_won" integer DEFAULT 0 NOT NULL,
	"h2h_heavy_games_lost" integer DEFAULT 0 NOT NULL,
	"h2h_total_match_duration_sec" integer DEFAULT 0 NOT NULL,
	"h2h_avg_match_duration_sec" numeric(10, 2),
	"h2h_last5_matches_won" integer DEFAULT 0 NOT NULL,
	"h2h_last5_matches_lost" integer DEFAULT 0 NOT NULL,
	"h2h_recent_results" jsonb,
	"h2h_recent_match_scores" jsonb,
	"matchup_comfort_index" numeric(6, 3),
	"matchup_status" "matchup_status",
	"has_closing_problem_vs_opponent" boolean DEFAULT false NOT NULL,
	"has_positive_trend_vs_opponent" boolean DEFAULT false NOT NULL,
	"is_high_load_opponent" boolean DEFAULT false NOT NULL,
	"sample_size_level" "sample_size_level",
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_player_opponent_uq" UNIQUE("player_id","opponent_id")
);
--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "sample_size_level" "sample_size_level";--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD CONSTRAINT "player_opponent_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD CONSTRAINT "player_opponent_stats_opponent_id_players_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pos_player_idx" ON "player_opponent_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "pos_opponent_idx" ON "player_opponent_stats" USING btree ("opponent_id");--> statement-breakpoint
CREATE INDEX "pos_comfort_idx" ON "player_opponent_stats" USING btree ("matchup_comfort_index");--> statement-breakpoint
CREATE INDEX "pos_status_idx" ON "player_opponent_stats" USING btree ("matchup_status");--> statement-breakpoint
CREATE INDEX "pos_calculated_at_idx" ON "player_opponent_stats" USING btree ("calculated_at");