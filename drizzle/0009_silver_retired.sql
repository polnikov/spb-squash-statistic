ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "retired" boolean DEFAULT false NOT NULL;
