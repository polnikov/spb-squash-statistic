CREATE TYPE "public"."parse_status" AS ENUM('pending', 'queued', 'parsing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('done', 'upcoming');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"division" smallint NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"games_a" smallint NOT NULL,
	"games_b" smallint NOT NULL,
	"winner_id" integer,
	"score_detail" jsonb,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rankedin_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_rankedin_id_unique" UNIQUE("rankedin_id")
);
--> statement-breakpoint
CREATE TABLE "points_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"division" smallint,
	"place" smallint NOT NULL,
	"points" smallint NOT NULL,
	CONSTRAINT "points_table_uq" UNIQUE("season_id","division","place")
);
--> statement-breakpoint
CREATE TABLE "results" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"division" smallint NOT NULL,
	"player_id" integer NOT NULL,
	"place" smallint NOT NULL,
	"matches" smallint DEFAULT 0 NOT NULL,
	"won_matches" smallint DEFAULT 0 NOT NULL,
	"lost_matches" smallint DEFAULT 0 NOT NULL,
	"games" smallint DEFAULT 0 NOT NULL,
	"won_games" smallint DEFAULT 0 NOT NULL,
	"lost_games" smallint DEFAULT 0 NOT NULL,
	"balls" integer DEFAULT 0 NOT NULL,
	"won_balls" integer DEFAULT 0 NOT NULL,
	"lost_balls" integer DEFAULT 0 NOT NULL,
	"court_minutes" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"skill" numeric(4, 1),
	"points" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "results_uq" UNIQUE("stage_id","division","player_id")
);
--> statement-breakpoint
CREATE TABLE "rosters" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"division" smallint NOT NULL,
	"player_id" integer NOT NULL,
	CONSTRAINT "rosters_uq" UNIQUE("season_id","division","player_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"start_year" integer NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seasons_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "stage_divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"stage_id" integer NOT NULL,
	"division" smallint NOT NULL,
	"rankedin_tournament_id" text,
	"parse_status" "parse_status" DEFAULT 'pending' NOT NULL,
	"parsed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "stage_divisions_stage_division_uq" UNIQUE("stage_id","division")
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"number" smallint NOT NULL,
	"date" date,
	"status" "stage_status" DEFAULT 'upcoming' NOT NULL,
	CONSTRAINT "stages_season_number_uq" UNIQUE("season_id","number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_players_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_table" ADD CONSTRAINT "points_table_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rosters" ADD CONSTRAINT "rosters_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_divisions" ADD CONSTRAINT "stage_divisions_stage_id_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;