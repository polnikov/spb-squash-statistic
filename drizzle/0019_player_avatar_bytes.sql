-- Avatars were stored as a base64 data URL in a text column and shipped inside
-- every page's payload. Keep the encoded bytes instead; they are served by
-- /api/player-avatar and cached by the browser.
ALTER TABLE "player_avatars" ADD COLUMN "image" bytea;--> statement-breakpoint
ALTER TABLE "player_avatars" ADD COLUMN "mime" text DEFAULT 'image/webp' NOT NULL;--> statement-breakpoint

UPDATE "player_avatars"
SET "image" = decode(split_part("data_url", ',', 2), 'base64'),
    "mime" = coalesce(nullif(split_part(split_part("data_url", ',', 1), ';', 1), ''), 'data:image/webp')
WHERE "data_url" IS NOT NULL;--> statement-breakpoint

-- The mime landed as "data:image/png"; strip the scheme.
UPDATE "player_avatars" SET "mime" = replace("mime", 'data:', '');--> statement-breakpoint

DELETE FROM "player_avatars" WHERE "image" IS NULL;--> statement-breakpoint
ALTER TABLE "player_avatars" ALTER COLUMN "image" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "player_avatars" DROP COLUMN "data_url";
