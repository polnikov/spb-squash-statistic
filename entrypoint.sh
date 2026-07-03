#!/bin/sh
# App container entrypoint: apply pending DB migrations, then start Next.js.
# Uses `drizzle-kit migrate` (applies committed SQL from ./drizzle) — it is
# non-interactive and never prompts. Do NOT use `drizzle-kit push` here: push
# diffs the live schema and asks for confirmation on a TTY, which does not exist
# in the container (the "Interactive prompts require a TTY" error).
#
# migrate runs under a timeout and never blocks startup: if it hangs (lock/
# partial state) or exits non-zero, we log and start the app anyway on the
# current schema instead of crash-looping the container. A hard failure here
# would only surface as runtime query errors — check these logs after deploy.
set -e

echo '[entrypoint] applying drizzle migrations...'
if timeout 30 npx drizzle-kit migrate; then
  echo '[entrypoint] migrations up to date.'
else
  echo '[entrypoint] WARNING: migrate failed or timed out — starting on current schema.' >&2
fi

echo '[entrypoint] starting Next.js...'
exec npm run start
