# SeSha Stone

**SeSha Stone Pvt. Ltd.** — premium jewellery e-commerce · *Timeless Elegance* · www.seshastone.com

A complete online jewellery store: a luxury storefront, a permission-based admin panel and a REST API, with UPI QR and bank-transfer payments that are verified by staff before an order is confirmed.

| App | Path | Local URL | Stack |
| --- | --- | --- | --- |
| Storefront | `apps/web` | http://localhost:3000 | Next.js 15 (App Router), React 19, TypeScript |
| Admin panel | `apps/admin` | http://localhost:3001 | Next.js 15, React 19, TypeScript |
| API | `apps/api` | http://localhost:4000/api/v1 · docs at `/api/docs` | NestJS 11, Prisma 6, PostgreSQL, Redis, S3, Meilisearch |

## Features

- **Catalogue:** Gold, Silver, Diamond and Premium Artificial jewellery lines.
  - Artificial pieces are always clearly labelled.
  - Line-specific attributes are shown only when verified.
  - Collections can be hand-picked or automatic (new arrivals, bestsellers).
  - SEO URLs such as `/gold/rings` and `/product/<slug>`.
  - Search and filters.
- **Shopping:**
  - A bag re-priced by the server at quote and checkout.
  - A distraction-free checkout with delivery and billing addresses.
  - Duplicate-submit protection.
  - Wishlist, account pages, returns and public order tracking.
- **Payments:** see [docs/PAYMENT_SETUP.md](docs/PAYMENT_SETUP.md).
  - UPI with the original, server-verified QR.
  - SBI bank transfer.
  - UTR and proof upload.
  - Staff verify or reject, and record refunds.
  - A gateway abstraction (Razorpay / Cashfree) that stays off until configured.
- **Admin:**
  - Role-based access: Super Admin, Admin, Order / Product / Marketing Manager, Support.
  - Dashboard, orders and fulfilment, payments, refunds, products, inventory, collections, campaigns and banners, CMS, coupons, reviews, customers and marketing.
  - Business and payment settings with masking, confirmation and change history.
  - Staff management and an audit log.
- **Brand:** design tokens, Cormorant Garamond + Montserrat, an SS monogram logo system, favicons and app icons.
  - Logo artwork is a **temporary placeholder** until approved files are supplied; see [docs/BRAND_GUIDELINES.md](docs/BRAND_GUIDELINES.md).
- **Quality:**
  - ESLint, TypeScript and unit tests.
  - A Playwright API, journey, responsive (9 widths) and axe accessibility suite.
  - Security headers, rate limiting and an audit trail.

## Quick start

Requirements: Node.js 20+, Docker.

```bash
docker compose up -d                       # Postgres, Redis, MinIO (S3), Meilisearch
npm install                                # all workspaces; generates the Prisma client

cp apps/api/.env.example apps/api/.env     # fill in SEED_* business, bank and UPI values (never committed)
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local

npm run db:migrate
npm run db:seed                            # Super Admin, categories, collections, draft policies, verified UPI QR

npm run dev:api     # :4000
npm run dev:web     # :3000
npm run dev:admin   # :3001 — admin@seshastone.com / ChangeMe123! (change immediately)
```

For local demo products, set `SEED_DEMO_PRODUCTS=true` before seeding. Create a public-read `seshastone-media` bucket in MinIO (http://localhost:9001) for image uploads.

## Business, bank and UPI details

These are **database settings**, edited in Admin → Settings. They are never in code or git; this repository is public.

- Customers see bank and UPI details only on their own order's payment page.
- The original UPI QR is kept unmodified at `public/payment/upi-qr/current-upi-qr.png` and imported by the seed.
- In production, upload or replace the QR in Admin → Settings → UPI QR code. It is accepted only if it pays the configured UPI ID.

See [docs/BUSINESS_SETTINGS_GUIDE.md](docs/BUSINESS_SETTINGS_GUIDE.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` | Lint, types, unit tests, production builds |
| `npm run test:e2e` | Playwright end-to-end suite (stack must be running) |
| `npm run db:migrate` / `npm run db:seed` | Prisma migrations / idempotent seed |
| `npm run brand:generate` | Regenerate logo SVGs, favicons and icons from the brand fonts |

## Documentation

| Document | |
| --- | --- |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | System design, modules, order / stock / payment lifecycle |
| [DATABASE](docs/DATABASE.md) | Data model, conventions, migrations, backups |
| [API](docs/API.md) | Endpoints and permissions |
| [PAYMENT_SETUP](docs/PAYMENT_SETUP.md) | UPI, bank transfer, verification, refunds, gateways |
| [ADMIN_GUIDE](docs/ADMIN_GUIDE.md) | Roles and everyday admin tasks |
| [BUSINESS_SETTINGS_GUIDE](docs/BUSINESS_SETTINGS_GUIDE.md) | Every setting, who can edit it, privacy rules |
| [BRAND_GUIDELINES](docs/BRAND_GUIDELINES.md) | Colour, type, logo system, photography, campaigns |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Hosting, DNS/SSL, environment, safe updates, backups, monitoring |
| [SECURITY](docs/SECURITY.md) | Controls, operational rules, known limitations |
| [TESTING](docs/TESTING.md) | Test commands and suites |
| [GO_LIVE_CHECKLIST](docs/GO_LIVE_CHECKLIST.md) | Everything to confirm before launch |
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) | Repository audit, decisions, and what is deferred and why |
