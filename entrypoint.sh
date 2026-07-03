#!/bin/sh
# App container entrypoint: apply pending DB migrations, then start Next.js.
# Used as the default CMD; other services (if any) override `command`.
set -e

echo '[entrypoint] applying drizzle migrations...' &&
npx drizzle-kit migrate &&
echo '[entrypoint] starting Next.js...' &&
exec npm run start
