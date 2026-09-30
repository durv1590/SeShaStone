# Se Sha Stone

E-commerce platform for the Se Sha Stone jewellery brand: a customer storefront, an admin panel, and a REST API.

```
                         SE SHA STONE
              ┌──────────────┴──────────────┐
         CUSTOMER WEB                  ADMIN PANEL
        apps/web (Next.js)          apps/admin (Next.js)
              └──────────────┬──────────────┘
                        REST /api/v1
                   apps/api (NestJS + Prisma)
       ┌─────────────┬───────┼────────┬─────────────┐
   PostgreSQL      Redis   Storage   Search      Payments
                            S3/MinIO  Meilisearch  Razorpay · Cashfree · UPI
```

| App | Path | Port | Stack |
| --- | --- | --- | --- |
| API | `apps/api` | 4000 | NestJS 11, Prisma 6, PostgreSQL, Redis, S3, Meilisearch |
| Storefront | `apps/web` | 3000 | Next.js 15 (App Router), React 19, TypeScript |
| Admin panel | `apps/admin` | 3001 | Next.js 15 (App Router), React 19, TypeScript |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the domain model, order/stock/payment lifecycle and API map.

## Getting started

Requirements: Node.js 20+, Docker.

```bash
# 1. Infrastructure: Postgres, Redis, MinIO (S3), Meilisearch
docker compose up -d

# 2. Install all workspaces (also generates the Prisma client)
npm install

# 3. Configure environments
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

# 4. Create the schema and seed an admin user + sample catalogue
npm run db:migrate
npm run db:seed

# 5. Run (three terminals)
npm run dev:api     # http://localhost:4000/api/v1  · Swagger at /api/docs
npm run dev:web     # http://localhost:3000
npm run dev:admin   # http://localhost:3001  (admin@seshastone.com / ChangeMe123!)
```

Create a bucket named `seshastone-media` in the MinIO console (http://localhost:9001) with public read access so product images uploaded from the admin panel can be served.

## Payments

Set the gateway keys in `apps/api/.env`, then enable methods under **Admin → Settings → Payment methods**.

- **Razorpay**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Webhook URL: `https://<api-host>/api/v1/payments/webhooks/razorpay` (events `payment.captured`, `payment.failed`, `order.paid`).
- **Cashfree**: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`. Webhook URL: `https://<api-host>/api/v1/payments/webhooks/cashfree`.
- **UPI** goes through `PAYMENT_DEFAULT_PROVIDER` with UPI pre-selected in the gateway checkout.
- **Cash on delivery** is toggled in Settings. The payment is marked captured when the order is marked delivered.

Webhooks are the source of truth. The storefront's post-checkout verify call only speeds up confirmation.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run build` | Builds all three apps |
| `npm run typecheck` | Type-checks all three apps |
| `npm test -w @seshastone/api` | API unit tests |
| `npm run db:migrate` | Applies/creates Prisma migrations (dev) |
| `npm run db:seed` | Seeds admin user, categories, a sample product, and an About page |
