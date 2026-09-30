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

## Brand

The brand board is at [`brand/seshastone-brand-reference.png`](brand/seshastone-brand-reference.png). The storefront follows it:

- **Palette:** Deep Charcoal `#1B1B1B`, Champagne Gold `#D4AF37`, Warm Ivory `#F8F6F1`, Deep Emerald `#0E4A3A`, Royal Burgundy `#722F37` and Platinum Silver `#C0C0C0`. These are CSS tokens in `apps/web/app/globals.css`. Gold is only used as a text colour on dark backgrounds; on ivory a darker `--gold-ink` keeps text readable.
- **Type:** Playfair Display for headings, Montserrat for body and buttons, Cormorant Garamond for product names and Inter for prices. They load through `next/font` (`apps/web/lib/fonts.ts`).
- **Logo and icons:** the SS monogram and the collection and trust-bar icons are in `apps/web/components/brand.tsx`.
- **Collections:** Gold, Silver, Diamond and Premium Artificial Jewellery are defined in `apps/web/lib/collections.ts`. Gold and Silver filter by metal, Diamond by gemstone, and Premium Artificial by the `premium-artificial-jewellery` category.
- **Hero:** to put a photo behind the home-page hero, add a *Home hero* banner under **Admin → CMS**.

The PhonePe QR code for the store's UPI ID is kept at [`public/payment/upi-qr/current-upi-qr.png`](public/payment/upi-qr/current-upi-qr.png) for reference. Checkout does not show this image. It generates its own QR for the same UPI ID with the order amount already filled in.

## Store details

Company name, contact details, UPI ID and bank account are **store settings**, not code. The repository is public, so they are never committed.

- Put them in the `SEED_STORE_*`, `SEED_UPI_*` and `SEED_BANK_*` variables in `apps/api/.env` (gitignored). `npm run db:seed` then writes them to the database and creates the Contact page.
- After that, edit them any time under **Admin → Settings**. Re-running the seed never overwrites values edited in the admin panel.

Customers only see the UPI ID and bank details on their own unpaid orders. They are not exposed through the public `/settings` endpoint.

## Payments

Enable methods under **Admin → Settings → Payment methods**.

- **UPI to the store's UPI ID** (on by default). The order page shows a QR code and an "Open UPI app" link with the amount filled in. The customer then submits the UTR / transaction ID.
- **Bank transfer (NEFT / IMPS)** (on by default). The order page shows the account details, with the order number to use as remarks. The customer submits the UTR.
- Admin checks the bank or UPI statement and clicks **Confirm** (or **Reject** for a wrong UTR) under **Payments**. The dashboard shows how many are waiting. Unpaid UPI / bank orders hold stock for 48 hours (configurable). Orders with a submitted UTR are never auto-cancelled.

The gateways below need keys in `apps/api/.env`:

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
