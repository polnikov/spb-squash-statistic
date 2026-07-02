ALTER TABLE "player_stats_aggregate" ADD COLUMN "five_game_matches" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "five_game_matches_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "five_game_matches_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "five_game_match_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "five_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "fifth_game_rallies_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "fifth_game_rallies_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "fifth_game_rally_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "close_games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "close_games_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "close_games_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "close_game_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "close_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "overtime_games_played" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "overtime_games_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "overtime_games_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "overtime_game_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "overtime_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "dominant_games_won" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "heavy_games_lost" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "dominant_game_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "heavy_game_loss_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "total_match_duration_sec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_match_duration_sec" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "shortest_match_duration_sec" integer;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "longest_match_duration_sec" integer;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_game_duration_sec" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_seconds_per_rally" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "match_load_score" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "form_index" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "match_conversion_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "game_conversion_pp" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "result_conversion_pp" numeric(6, 3);