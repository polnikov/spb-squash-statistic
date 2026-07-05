DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'skill_index_status'
  ) THEN
    CREATE TYPE "public"."skill_index_status" AS ENUM(
      'below_level',
      'developing',
      'competitive',
      'good',
      'strong',
      'very_strong',
      'dominant'
    );
  ELSIF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'skill_index_status'
      AND e.enumlabel IN ('beginner', 'elite')
  ) THEN
    ALTER TYPE "public"."skill_index_status" RENAME TO "skill_index_status_old";
    CREATE TYPE "public"."skill_index_status" AS ENUM(
      'below_level',
      'developing',
      'competitive',
      'good',
      'strong',
      'very_strong',
      'dominant'
    );

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'player_stats_aggregate'
        AND column_name = 'skill_index_status'
    ) THEN
      ALTER TABLE "player_stats_aggregate"
        ALTER COLUMN "skill_index_status" TYPE "public"."skill_index_status"
        USING (
          CASE
            WHEN "skill_index" IS NULL THEN NULL
            WHEN "skill_index" < 45 THEN 'below_level'
            WHEN "skill_index" < 50 THEN 'developing'
            WHEN "skill_index" < 55 THEN 'competitive'
            WHEN "skill_index" < 60 THEN 'good'
            WHEN "skill_index" < 67 THEN 'strong'
            WHEN "skill_index" < 72 THEN 'very_strong'
            ELSE 'dominant'
          END
        )::"public"."skill_index_status";
    END IF;

    DROP TYPE "public"."skill_index_status_old";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_index" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "player_stats_aggregate" ADD COLUMN IF NOT EXISTS "skill_index_status" "skill_index_status";--> statement-breakpoint
UPDATE "player_stats_aggregate"
SET "skill_index_status" = (
  CASE
    WHEN "skill_index" IS NULL THEN NULL
    WHEN "skill_index" < 45 THEN 'below_level'
    WHEN "skill_index" < 50 THEN 'developing'
    WHEN "skill_index" < 55 THEN 'competitive'
    WHEN "skill_index" < 60 THEN 'good'
    WHEN "skill_index" < 67 THEN 'strong'
    WHEN "skill_index" < 72 THEN 'very_strong'
    ELSE 'dominant'
  END
)::"skill_index_status";
