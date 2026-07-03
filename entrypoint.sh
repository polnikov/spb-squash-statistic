#!/bin/sh
# App container entrypoint: apply pending DB migrations, then start Next.js.
set -e

echo '[entrypoint] applying drizzle migrations...'
# Игнорируем код возврата, т.к. миграции уже применены или завершаются с предупреждениями
npx drizzle-kit migrate || true

echo '[entrypoint] starting Next.js...'
exec npm run start