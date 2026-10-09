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
| Email | Gmail SMTP with an app password (see **Email** below); SES, Brevo or Zoho later | `SMTP_*`; otherwise emails are recorded as SKIPPED |
| DNS / SSL / WAF | Cloudflare | Full (strict) TLS, HSTS, bot protection |

## Environment variables

Examples: `apps/api/.env.example`, `apps/web/.env.example`, `apps/admin/.env.example`.

- Never commit real values.
- Set `NODE_ENV=production`.
- Set a long random `JWT_SECRET` (for example `openssl rand -base64 48`).
- Set `CORS_ORIGINS` to the exact web and admin origins.
- Set `WEB_URL` to the storefront URL.
- Never set `E2E_DISABLE_RATE_LIMIT` in production (it is ignored there anyway).

## Email (Gmail)

The store sends order, payment, shipping and refund emails through Gmail's SMTP server, using a Google **app password**. An app password is a separate 16-character password that only lets the store send mail; it is not your Gmail password, and you can revoke it at any time.

1. Sign in to the Gmail account the store will send from.
2. Turn on **2-Step Verification** at https://myaccount.google.com/security (Google only offers app passwords when it is on).
3. Open https://myaccount.google.com/apppasswords, enter a name such as "SeSha Stone store", and choose **Create**. Copy the 16-character password Google shows. You will not be able to see it again.
4. On the API server, set these environment variables (in `apps/api/.env` or your host's secret settings), then restart the API:

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=<the Gmail address>
   SMTP_PASS=<the 16-character app password, without spaces>
   SMTP_FROM="SeSha Stone <the same Gmail address>"
   ```

5. Check the API log for `Email ready: sending through smtp.gmail.com`. If it says `Email login failed`, the address or app password is wrong.
6. In **Admin → Settings → Email**, choose **Send test email** and confirm it arrives (check the spam folder the first time).

Good to know:

- `SMTP_FROM` must be the same Gmail address as `SMTP_USER`. Gmail replaces any other sender address with the account's own, and the admin Email panel warns if they differ.
- Gmail allows about 500 emails a day from a personal account, which is enough for a new store. Moving to a provider that sends from `@seshastone.com` (such as Brevo, Zoho or Amazon SES) later only means changing these variables.
- Changing your Google password revokes app passwords, so create a new one and update `SMTP_PASS` if that happens.
- The app password is a secret: never commit it to git or paste it into chat or email.

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
