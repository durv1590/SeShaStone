# API

- Base URL: `/api/v1`.
- Interactive docs: `/api/docs` (Swagger).
- Authentication: `Authorization: Bearer <JWT>` from `/auth/login` (customers) or `/auth/admin/login` (staff).

All request bodies are validated, and unknown fields are rejected. Errors return `{ statusCode, message }`. A `409` with `confirmationRequired: true` means the request must be repeated with explicit confirmation.

## Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | DB and cache status |
| GET | `/settings` | Public business settings only; never bank or UPI details |
| GET | `/categories`, `/categories/:slug` | Category tree |
| GET | `/collections`, `/collections/:slug` | Active collections |
| GET | `/products` | Filters: `q, line, category, collection, metal, gemstone, tag, size, inStock, minPrice, maxPrice, featured, sort=newest\|price_asc\|price_desc\|bestselling, page, pageSize` |
| GET | `/products/:slug`, `/products/:slug/related` | Detail (verified attributes, stock flags, genuine rating) and related pieces |
| GET | `/products/:id/reviews` | Approved reviews only |
| GET | `/banners?placement=` | Live campaigns |
| GET | `/pages/:slug` | Published CMS pages |
| POST | `/auth/register`, `/auth/login`, `/auth/admin/login` | Rate-limited: 5 per minute |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Always 200 (no account discovery); single-use 30-minute token |
| POST | `/orders/track` | `{ orderNumber, email }`, rate-limited; returns status and tracking only |
| POST | `/newsletter/subscribe`, `/newsletter/unsubscribe` | |
| POST | `/payments/webhooks/:provider` | Gateway webhooks (HMAC-verified); inactive until keys are configured |

## Customer (authenticated)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/auth/me` | Includes `permissions` |
| GET/PATCH | `/me/profile` | |
| GET/POST/PATCH/DELETE | `/me/addresses[/:id]` | |
| GET/POST/DELETE | `/me/wishlist[/:productId]` | |
| POST | `/checkout/quote` | Server-side pricing, stock and coupon validation |
| POST | `/checkout` | `{ items, addressId, billingAddressId?, paymentProvider, couponCode?, notes?, idempotencyKey? }` |
| GET | `/me/orders`, `/me/orders/:id` | |
| POST | `/me/orders/:id/cancel` | Unpaid orders only |
| POST | `/me/orders/:id/return` | Delivered orders within the return window |
| GET | `/me/orders/:id/payment-instructions` | UPI (verified QR, UPI ID) or bank details, for the owner only |
| POST | `/me/orders/:id/payment-reference` | `{ reference }`: the UTR; sets the payment to SUBMITTED |
| POST | `/me/orders/:id/payment-evidence` | multipart `file`: PNG/JPEG/WebP/PDF, 5 MB, 3 per payment |
| GET | `/me/payment-evidence/:id` | Owner only |
| POST | `/coupons/validate`, `/reviews` | Reviews only from verified purchasers |

## Admin (permission in brackets)

| Method | Path |
| --- | --- |
| GET | `/admin/dashboard` [dashboard.view] |
| GET | `/admin/orders`, `/admin/orders/:id` [orders.view] · PATCH `/admin/orders/:id/status` [orders.manage] |
| GET | `/admin/payments` [payments.view] · GET `/admin/payment-evidence/:id` [payments.view] |
| POST | `/admin/payments/:id/verify`, `/admin/payments/:id/reject` [payments.verify] |
| GET | `/admin/refunds` · POST `/admin/orders/:id/refunds` · PATCH `/admin/refunds/:id` [refunds.manage] |
| CRUD | `/admin/products`, `/admin/variants/:id`, `/admin/categories` [products.view / products.manage] |
| CRUD | `/admin/collections` [products.view / content.manage] |
| GET/POST | `/admin/inventory`, `/admin/inventory/:variantId/adjust` [inventory.manage] |
| GET/PATCH | `/admin/customers` [customers.view / customers.manage] |
| GET/PATCH | `/admin/reviews` [reviews.moderate] |
| CRUD | `/admin/coupons`, `/admin/marketing/*` [marketing.manage] |
| CRUD | `/admin/pages`, `/admin/banners` [content.manage] · POST `/admin/uploads` [media.upload] |
| GET | `/admin/settings`, `/admin/settings/history`, `/admin/settings/upi-qr` [settings.view] |
| PUT | `/admin/settings`: store/shipping keys need settings.business.edit; `payments.*` keys need settings.payment.edit **and** `confirmFinancialChange: true` |
| POST | `/admin/settings/reveal` (audited) · POST/DELETE `/admin/settings/upi-qr` [settings.payment.edit] |
| GET | `/admin/settings/email` [settings.view]: email provider status (never the password); `?check=true` re-tests the SMTP login |
| POST | `/admin/settings/email/test` [settings.business.edit, 5/min]: sends a test email to `to`, or to the signed-in user; audited |
| GET/POST/PATCH | `/admin/users`, `/admin/users/roles` [users.manage] |
| GET | `/admin/audit-logs` [audit.view] |
