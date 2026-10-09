#!/bin/sh
# Runs the store on this computer for review: http://localhost:3000 (store), http://localhost:3001 (admin).
# Needs Docker Desktop. On Windows, run it from Git Bash.
#   ./preview.sh start   build and start everything, then seed on first run
#   ./preview.sh stop    stop (your data is kept)
#   ./preview.sh reset   stop and delete all preview data
#   ./preview.sh logs    follow the API log
set -eu
cd "$(dirname "$0")"
# Caddy (HTTPS) is not used in a preview, so its certificate email may still be empty.
compose() { ACME_EMAIL="${ACME_EMAIL:-preview@localhost}" docker compose -p seshastone-preview -f docker-compose.yml -f docker-compose.preview.yml "$@"; }

case "${1:-start}" in
  start)
    if [ ! -f .env ]; then
      ./init.sh
      # Show the demo products in a preview unless the .env says otherwise.
      sed -i.bak 's/^SEED_DEMO_PRODUCTS=.*/SEED_DEMO_PRODUCTS=true/' .env && rm -f .env.bak
      echo
      echo "Now fill in your store, UPI and bank details (SEED_*) in deploy/.env,"
      echo "then run ./preview.sh start again. They are read once, when the store is first set up."
      exit 0
    fi
    compose up -d --build
    echo "Waiting for the API to be ready…"
    i=0
    until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose ps -q api)" 2>/dev/null)" = healthy ]; do
      i=$((i + 1)); [ "$i" -gt 60 ] && { echo "The API did not start. Run: ./preview.sh logs"; exit 1; }
      sleep 3
    done
    compose exec -T api npm run prisma:seed
    echo
    echo "  Storefront: http://localhost:3000"
    echo "  Admin:      http://localhost:3001  (login: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in deploy/.env)"
    ;;
  stop) compose stop ;;
  reset) compose down -v ;;
  logs) compose logs -f api ;;
  *) echo "Usage: ./preview.sh [start|stop|reset|logs]"; exit 1 ;;
esac
