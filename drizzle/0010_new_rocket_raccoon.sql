ALTER TABLE "points_table" DROP CONSTRAINT IF EXISTS "points_table_uq";--> statement-breakpoint
ALTER TABLE "points_table" DROP CONSTRAINT IF EXISTS "points_table_season_id_seasons_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "points_table_lookup_idx";--> statement-breakpoint
ALTER TABLE "points_table" ALTER COLUMN "division" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "retired" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "points_table_lookup_idx" ON "points_table" USING btree ("division","effective_from");--> statement-breakpoint
ALTER TABLE "points_table" DROP COLUMN IF EXISTS "season_id";--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'points_table_uq'
		AND conrelid = 'points_table'::regclass
	) THEN
		ALTER TABLE "points_table" ADD CONSTRAINT "points_table_uq" UNIQUE("division","effective_from","place");
	END IF;
END $$;
