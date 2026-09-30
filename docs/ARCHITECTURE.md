# Architecture

## Overview

- **apps/web**: customer storefront. Catalogue pages are server-rendered from the API. Cart, auth and checkout run client-side, and the cart is kept in `localStorage`.
- **apps/admin**: back-office SPA on Next.js. Only `STAFF` / `ADMIN` accounts can sign in (`POST /auth/admin/login`).
- **apps/api**: NestJS modular monolith. All routes are under `/api/v1`, and Swagger is served at `/api/docs`.

Every API route requires a JWT unless it is decorated with `@Public()`. `@Roles(...)` limits admin routes to `STAFF` and `ADMIN`.

## Infrastructure modules (`apps/api/src`)

| Module | Backing service | Used for |
| --- | --- | --- |
| `prisma` | PostgreSQL | System of record |
| `redis` | Redis | Cache for category tree, banners, settings. Best-effort: Redis outages never fail requests |
| `storage` | S3 / MinIO | Presigned PUT uploads from the admin panel (`POST /admin/uploads`) |
| `search` | Meilisearch | Product full-text search and filters. Falls back to Postgres `ILIKE` when unavailable |
| `payments` | Razorpay / Cashfree | Gateway adapters behind a common `PaymentGateway` interface |

## Domain modules

Customers · Addresses · Categories · Products (+ variants, images) · Inventory · Orders · Payments · Coupons · Reviews · Wishlist · CMS (pages, banners) · Marketing (newsletter, campaigns) · Settings.

All money is stored as **integer paise**. Variant prices include GST. The GST component is extracted per line (`gstRate`, default 3%) for invoices.

## Order, stock and payment lifecycle

```
checkout ──► Order PENDING_PAYMENT ──► stock RESERVED (reserved += qty)
                │                               │
                │ gateway webhook / verify      │ cancel or expiry (TTL, default 30 min)
                ▼                               ▼
          Order PAID ──► stock SALE      Order CANCELLED ──► stock RELEASED
          (quantity -= qty, reserved -= qty)
                │
                ▼
     PROCESSING ──► SHIPPED ──► DELIVERED
```

- Stock is reserved with a conditional `UPDATE … WHERE quantity - reserved >= qty`, so concurrent checkouts cannot oversell a single piece.
- Coupon usage limits use the same conditional-update pattern. Cancelling an order frees its coupon redemption.
- Payment events are applied idempotently (a replayed webhook is a no-op). Webhook signatures are verified with HMAC-SHA256 over the raw body.
- Direct UPI (`UPI_DIRECT`) and bank transfer (`BANK_TRANSFER`) orders stay `PENDING_PAYMENT` with a pending `Payment` row. The customer gets instructions from `GET /me/orders/:id/payment-instructions` and reports a UTR with `POST /me/orders/:id/payment-reference`. Staff then call `POST /admin/payments/:id/confirm`, which runs the same `markPaid` path as a gateway capture, or `…/reject`. These orders are held for `checkout.manualPaymentHoldHours` (default 48). Once a UTR has been submitted they are not auto-expired.
- Cancelling an order marks its open payments `FAILED`.
- Cash-on-delivery orders go straight to `PROCESSING`. Their stock is sold at checkout and their payment is captured on delivery.
- Admin status changes follow an explicit transition table (`orders.service.ts`). Cancelling a paid order returns its stock to inventory.
- Every stock change writes an `InventoryMovement` row (RESTOCK, ADJUSTMENT, RESERVE, RELEASE, SALE, RETURN).

## API map (abridged)

| Area | Public / customer | Admin |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` | `POST /auth/admin/login` |
| Catalogue | `GET /categories`, `GET /products`, `GET /products/:slug` | `/admin/categories`, `/admin/products`, `/admin/variants/:id`, `POST /admin/products/reindex` |
| Account | `/me/profile`, `/me/addresses`, `/me/wishlist`, `/me/orders` | `/admin/customers` |
| Checkout | `POST /checkout/quote`, `POST /checkout`, `POST /coupons/validate` | `/admin/orders`, `PATCH /admin/orders/:id/status`, `GET /admin/dashboard` |
| Payments | `POST /payments/initiate`, `POST /payments/verify`, `POST /payments/webhooks/:provider`, `GET /me/orders/:id/payment-instructions`, `POST /me/orders/:id/payment-reference` | `GET /admin/payments`, `POST /admin/payments/:id/confirm`, `POST /admin/payments/:id/reject` |
| Inventory | — | `GET /admin/inventory`, `POST /admin/inventory/:variantId/adjust` |
| Coupons | — | `/admin/coupons` |
| Reviews | `GET /products/:id/reviews`, `POST /reviews` (verified purchasers only) | `/admin/reviews` (moderation) |
| CMS | `GET /pages/:slug`, `GET /banners` | `/admin/pages`, `/admin/banners` |
| Marketing | `POST /newsletter/subscribe`, `POST /newsletter/unsubscribe` | `/admin/marketing/subscribers`, `/admin/marketing/campaigns` |
| Settings | `GET /settings` (public keys only) | `GET/PUT /admin/settings` |
| Media | — | `POST /admin/uploads` |

## Not yet implemented

- Sending campaign and transactional emails or SMS. Campaigns are stored and scheduled, but nothing delivers them yet.
- Automatic matching of UPI / bank transfers. Staff confirm each UTR by hand against the statement.
- Gateway refunds. Marking an order `REFUNDED` only changes its status; the money must be refunded in the gateway dashboard.
- Shipping-partner integrations (Shiprocket, Delhivery). Tracking numbers are entered by hand.
- Live gold-rate pricing. Variant prices are set manually.
