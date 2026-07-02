ALTER TABLE "matches" ADD COLUMN "player_a_trailed_0_2" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player_b_trailed_0_2" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player_a_led_2_0" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "player_b_led_2_0" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "is_reverse_sweep" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reverse_sweep_winner_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "reverse_sweep_loser_id" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "was_fifth_forced_after_0_2" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_matches_trailed_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_reverse_sweep_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_reverse_sweep_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_forced_fifth_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_forced_fifth_rate_after_trailing_0_2_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_matches_lost_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_games_won_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_avg_games_won_after_trailing_0_2" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_matches_led_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_wins_after_leading_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_losses_after_leading_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_blown_two_game_lead_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_opponent_stats" ADD COLUMN "h2h_reverse_sweep_losses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "matches_trailed_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "reverse_sweep_wins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "reverse_sweep_win_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "forced_fifth_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "forced_fifth_rate_after_trailing_0_2_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "matches_lost_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "games_won_after_trailing_0_2" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "avg_games_won_after_trailing_0_2" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "matches_led_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "wins_after_leading_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "losses_after_leading_2_0" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "blown_two_game_lead_rate_pct" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN "reverse_sweep_losses" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reverse_sweep_winner_id_players_id_fk" FOREIGN KEY ("reverse_sweep_winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reverse_sweep_loser_id_players_id_fk" FOREIGN KEY ("reverse_sweep_loser_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;