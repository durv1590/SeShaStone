#!/bin/sh
# First-time setup: creates deploy/.env from .env.example with random secrets.
# Safe to re-run: it never overwrites an existing .env.
set -eu
cd "$(dirname "$0")"

if [ -f .env ]; then
  echo ".env already exists; leaving it unchanged."
  exit 0
fi

rand() { openssl rand -hex "$1"; }
ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"

sed \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 24)|" \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 48)|" \
  -e "s|^MEILI_MASTER_KEY=.*|MEILI_MASTER_KEY=$(rand 24)|" \
  -e "s|^SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=${ADMIN_PASSWORD}|" \
  .env.example > .env
chmod 600 .env

echo "Created deploy/.env with new secrets."
echo
echo "  First admin password: ${ADMIN_PASSWORD}"
echo "  (also saved in .env as SEED_ADMIN_PASSWORD; change it after your first login)"
echo
echo "Next: edit .env (ACME_EMAIL, SMTP_*, SEED_* store, UPI and bank details), then follow docs/DEPLOYMENT.md."
