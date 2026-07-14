CREATE TABLE "dismissed_duplicate_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_a_id" integer NOT NULL,
	"player_b_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dismissed_duplicate_pairs_uq" UNIQUE("player_a_id","player_b_id")
);
--> statement-breakpoint
ALTER TABLE "dismissed_duplicate_pairs" ADD CONSTRAINT "dismissed_duplicate_pairs_player_a_id_players_id_fk" FOREIGN KEY ("player_a_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dismissed_duplicate_pairs" ADD CONSTRAINT "dismissed_duplicate_pairs_player_b_id_players_id_fk" FOREIGN KEY ("player_b_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "dismissed_duplicate_pairs_a_idx" ON "dismissed_duplicate_pairs" USING btree ("player_a_id");
--> statement-breakpoint
CREATE INDEX "dismissed_duplicate_pairs_b_idx" ON "dismissed_duplicate_pairs" USING btree ("player_b_id");
