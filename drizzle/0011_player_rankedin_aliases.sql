CREATE TABLE "player_rankedin_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"rankedin_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_rankedin_aliases_rankedin_id_unique" UNIQUE("rankedin_id")
);
--> statement-breakpoint
ALTER TABLE "player_rankedin_aliases" ADD CONSTRAINT "player_rankedin_aliases_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "player_rankedin_aliases_player_idx" ON "player_rankedin_aliases" USING btree ("player_id");
