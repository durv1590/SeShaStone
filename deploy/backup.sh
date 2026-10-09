#!/bin/sh
# Backs up the database and uploaded images to deploy/backups/, keeping 14 days.
# Run daily from cron (see docs/DEPLOYMENT.md), and copy the backups off the server regularly.
set -eu
cd "$(dirname "$0")"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M)"

docker compose exec -T postgres pg_dump -U seshastone --clean --if-exists seshastone | gzip > "backups/db-${STAMP}.sql.gz"
docker compose run --rm --no-deps -T --user root -v "$(pwd)/backups:/backups" --entrypoint sh api \
  -c "tar -czf /backups/media-${STAMP}.tar.gz -C /data/media ."

find backups -name 'db-*.sql.gz' -mtime +14 -delete
find backups -name 'media-*.tar.gz' -mtime +14 -delete
echo "Backup written: backups/db-${STAMP}.sql.gz, backups/media-${STAMP}.tar.gz"
