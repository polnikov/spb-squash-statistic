CREATE TABLE "player_avatars" (
	"player_id" integer PRIMARY KEY NOT NULL,
	"data_url" text NOT NULL,
	"file_name" text,
	"scale" smallint DEFAULT 120 NOT NULL,
	"offset_x" smallint DEFAULT 0 NOT NULL,
	"offset_y" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_avatars" ADD CONSTRAINT "player_avatars_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
