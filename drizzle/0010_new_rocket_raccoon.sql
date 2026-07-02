ALTER TABLE "points_table" DROP CONSTRAINT "points_table_uq";--> statement-breakpoint
ALTER TABLE "points_table" DROP CONSTRAINT "points_table_season_id_seasons_id_fk";
--> statement-breakpoint
DROP INDEX "points_table_lookup_idx";--> statement-breakpoint
ALTER TABLE "points_table" ALTER COLUMN "division" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "retired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "points_table_lookup_idx" ON "points_table" USING btree ("division","effective_from");--> statement-breakpoint
ALTER TABLE "points_table" DROP COLUMN "season_id";--> statement-breakpoint
ALTER TABLE "points_table" ADD CONSTRAINT "points_table_uq" UNIQUE("division","effective_from","place");