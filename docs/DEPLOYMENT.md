# Deployment

## Recommended production topology

| Component | Suggested service | Notes |
| --- | --- | --- |
| Storefront `apps/web` | Vercel (or any Node host) → `www.seshastone.com` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` |
| Admin `apps/admin` | Vercel / Node host → `admin.seshastone.com` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STORE_URL`. Consider IP allow-listing or Cloudflare Access |
| API `apps/api` | Container / Node host (AWS ECS, Render, Railway, a VM) → `api.seshastone.com` | Run `node dist/main` behind HTTPS; one or more instances |
| PostgreSQL | Managed (AWS RDS, Neon, Supabase, Crunchy) | Point-in-time recovery on |
| Redis | Managed (Upstash, ElastiCache) | Cache only; safe to lose |
| Object storage | AWS S3 / Cloudflare R2 + CDN | Public-read bucket for product and campaign images only |
| Search | Meilisearch Cloud (optional) | The catalogue falls back to database search |
| Email | SES, Postmark, Zoho or Gmail SMTP | `SMTP_*`; otherwise emails are recorded as SKIPPED |
| DNS / SSL / WAF | Cloudflare | Full (strict) TLS, HSTS, bot protection |

## Environment variables

Examples: `apps/api/.env.example`, `apps/web/.env.example`, `apps/admin/.env.example`.

- Never commit real values.
- Set `NODE_ENV=production`.
- Set a long random `JWT_SECRET` (for example `openssl rand -base64 48`).
- Set `CORS_ORIGINS` to the exact web and admin origins.
- Set `WEB_URL` to the storefront URL.
- Never set `E2E_DISABLE_RATE_LIMIT` in production (it is ignored there anyway).

## First deployment

1. Provision PostgreSQL, Redis and the S3 bucket. Create the bucket with public-read on objects and an HTTPS CDN domain.
2. Configure DNS in Cloudflare:
   - `www` → storefront host
   - `admin` → admin host
   - `api` → API host
   - apex → redirect to `www`
3. Build: `npm ci && npm run build`. `postinstall` generates the Prisma client.
4. Apply migrations: `npm run prisma:deploy -w @seshastone/api`.
5. Seed once with the production `SEED_*` values in the API environment:
   `SEED_DEMO_PRODUCTS=false npm run db:seed`
   This creates the Super Admin, categories, collections and policy pages, imports the verified UPI QR, and fills business settings.
6. Sign in to the admin panel. Change the seeded admin password: log out, then use "Forgot password", or create a new Super Admin and disable the seeded one.
7. Complete [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md).

## Updating without losing orders or payments

- Migrations are additive and committed. Production runs **`prisma migrate deploy`** only, never `migrate dev` or `db push`.
- Deploy order: **database migration → API → web / admin**. Each migration must stay compatible with the previous API version for the length of the rollout (expand → migrate → contract).
- Before any migration that drops or rewrites data, take a manual snapshot. Review the SQL in the PR.
- The API shuts down gracefully on SIGTERM (`enableShutdownHooks`), so let in-flight requests drain before stopping old instances.
- Orders, payments, refunds and audit logs are never deleted by the application.

## Backups

- Managed PostgreSQL point-in-time recovery, kept for at least 7 days.
- A nightly `pg_dump -Fc` to a separate, encrypted bucket, kept for 30 days.
- A monthly restore drill into a staging database.
- S3 versioning on the media bucket.

## Logging, monitoring and error tracking

- The API logs to stdout; ship the logs to your host's log service. Payment secrets, tokens and bank details are never logged.
- Uptime checks: `GET https://api.seshastone.com/api/v1/health` (DB and cache), plus the storefront home page.
- Recommended: Sentry, or the host's equivalent, for the API and both Next.js apps.
- Alerts for 5xx rate, health failures and database CPU and storage.
- Watch the admin dashboard daily for **payments to verify** and **pending refunds**.
