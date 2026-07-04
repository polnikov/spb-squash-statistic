#!/bin/sh
# App container entrypoint: apply pending DB migrations, then start Next.js.
# Uses `drizzle-kit migrate` (applies committed SQL from ./drizzle) — it is
# non-interactive and never prompts. Do NOT use `drizzle-kit push` here: push
# diffs the live schema and asks for confirmation on a TTY, which does not exist
# in the container (the "Interactive prompts require a TTY" error).
#
# Migration failure must stop startup. Running the app against an older schema
# causes production-only Server Component crashes (for example, missing columns
# after a deploy). Let the container fail so Docker/release logs show the real
# migration error instead of hiding it until runtime.
set -e

echo '[entrypoint] applying drizzle migrations...'
if timeout 180 npm run db:migrate; then
  echo '[entrypoint] migrations up to date.'
else
  code=$?
  echo "[entrypoint] ERROR: drizzle migrations failed with exit code ${code}"
  echo '[entrypoint] container will pause briefly so deploy logs can capture the error.'
  sleep 60
  exit "$code"
fi

echo '[entrypoint] starting Next.js...'
exec npm run start
