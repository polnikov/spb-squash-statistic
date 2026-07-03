#!/bin/sh
# App container entrypoint: apply pending DB migrations, then start Next.js.
# Uses `drizzle-kit migrate` (applies committed SQL from ./drizzle) — it is
# non-interactive and never prompts. Do NOT use `drizzle-kit push` here: push
# diffs the live schema and asks for confirmation on a TTY, which does not exist
# in the container (the "Interactive prompts require a TTY" error).
set -e

echo '[entrypoint] applying drizzle migrations...'
npx drizzle-kit migrate

echo '[entrypoint] starting Next.js...'
exec npm run start
