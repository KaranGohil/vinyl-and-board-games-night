#!/usr/bin/env bash
# Dumps the database to ./backups/vbgn-YYYY-MM-DD-HHMM.sql.gz and keeps the newest 14.
# Run from the repository folder. Example nightly cron (crontab -e):
#   15 3 * * * cd /home/you/vinyl-and-board-games-night && ./deploy/backup.sh >> backups/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

mkdir -p backups
file="backups/vbgn-$(date +%Y-%m-%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-vbgn}" "${POSTGRES_DB:-vbgn}" | gzip > "$file"
echo "Saved $file"

ls -1t backups/vbgn-*.sql.gz | tail -n +15 | xargs -r rm --
