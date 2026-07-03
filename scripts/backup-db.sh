#!/usr/bin/env bash
# Online backup of the PostgreSQL database.
# Schedule: every 3 days via systemd timer (see bbr-backup.timer).
# Retention: 30 days.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/docker/bbr}"
BACKUP_DIR="${APP_DIR}/backups"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
PG_CONTAINER="${PG_CONTAINER:-bbr-postgres}"

# Credentials: defaults match docker-compose; overridden by /opt/docker/bbr/.env.
POSTGRES_USER="${POSTGRES_USER:-bbr}"
POSTGRES_DB="${POSTGRES_DB:-bbr}"
if [ -f "${APP_DIR}/.env" ]; then
    v=$(grep -E '^POSTGRES_USER=' "${APP_DIR}/.env" | tail -1 | cut -d= -f2-); [ -n "$v" ] && POSTGRES_USER="$v"
    v=$(grep -E '^POSTGRES_DB=' "${APP_DIR}/.env" | tail -1 | cut -d= -f2-); [ -n "$v" ] && POSTGRES_DB="$v"
fi

mkdir -p "$BACKUP_DIR"

stamp=$(date +%Y%m%d-%H%M%S)
out="${BACKUP_DIR}/bbr-${stamp}.sql.gz"

log() { printf '[%s] %s\n' "$(date -Is)" "$*" >> "$LOG_FILE"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    log "ERROR: postgres container not running: $PG_CONTAINER"
    exit 1
fi

log "Starting backup of ${POSTGRES_DB} from ${PG_CONTAINER}"

# pg_dump inside the container — consistent snapshot while the app is running.
docker exec "$PG_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --no-owner --clean --if-exists | gzip -9 > "$out"

# Retention sweep.
deleted=$(find "$BACKUP_DIR" -maxdepth 1 -name 'bbr-*.sql.gz' -type f -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)

log "Wrote ${out}; pruned ${deleted} backups older than ${RETENTION_DAYS} days"
