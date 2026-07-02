ALTER TABLE "points_table" DROP CONSTRAINT "points_table_uq";--> statement-breakpoint
ALTER TABLE "points_table" ADD COLUMN "effective_from" date NOT NULL;--> statement-breakpoint
CREATE INDEX "points_table_lookup_idx" ON "points_table" USING btree ("season_id","division","effective_from");--> statement-breakpoint
ALTER TABLE "points_table" ADD CONSTRAINT "points_table_uq" UNIQUE("season_id","division","effective_from","place");