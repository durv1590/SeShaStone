#!/bin/sh
# Deploys the latest code: backs up, pulls from GitHub, rebuilds and restarts.
# Database migrations run automatically when the API starts.
set -eu
cd "$(dirname "$0")"

./backup.sh
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
