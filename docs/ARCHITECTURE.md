# Architecture

SeSha Stone is an npm-workspaces monorepo with three applications and a shared PostgreSQL database.

```
                  Customers                                Staff
                      │                                      │
            apps/web (Next.js 15)                 apps/admin (Next.js 15)
       storefront · SSR catalogue · checkout      permission-aware back office
                      └──────────────┬───────────────────────┘
                              REST  /api/v1  (JWT)
                        apps/api (NestJS 11 + Prisma 6)
      ┌──────────────┬───────────┬──────────┬────────────┬──────────────┐
  PostgreSQL       Redis   Media (disk/S3) Meilisearch   SMTP (optional)  Razorpay / Cashfree
 (system of      (cache,     (product &   (product      (transactional   (optional, not
  record)         rate data)  campaign     search, DB    email)           activated)
                              images)      fallback)
```

The admin panel is a separate app (not `web/app/admin`), so back-office code and routes never ship to shoppers.

## API modules (`apps/api/src`)

| Area | Modules |
| --- | --- |
| Infrastructure | `prisma`, `redis` (best-effort cache), `storage` (signed upload links: local disk served by Caddy in production, or S3/R2), `search` (Meilisearch), `notifications` (SMTP or recorded as SKIPPED), `audit` (append-only log) |
| Identity | `auth` (JWT, password reset, admin login), `users` (staff and roles), `customers`, `addresses` |
| Catalogue | `products` (lines, attributes, variants, images, related, bestsellers), `categories`, `collections`, `inventory`, `reviews`, `wishlist` |
| Commerce | `orders` (quote, checkout, lifecycle, returns, tracking, dashboard), `payments` (gateways, manual UPI/bank, evidence, refunds), `coupons` |
| Content | `cms` (pages, campaign banners), `marketing` (newsletter, email campaigns), `settings` (business configuration and the UPI QR asset) |

Cross-cutting guards, applied globally:

- **`ThrottlerGuard`:** 120 requests per minute per IP by default. Auth, checkout, tracking and payment submission have stricter limits.
- **`JwtAuthGuard`:** every route needs a token unless it is marked `@Public()`.
- **`RolesGuard`:** checks `@RequirePermissions()` against the role → permission map in `common/auth/permissions.ts`.

## Storefront (`apps/web`)

- Server components render catalogue pages from the API.
- Interactive pieces are client components: cart, checkout, account, payment step, gallery, mega menu, drawer and search.
- The cart lives in `localStorage` and is re-priced by the server at quote and at checkout.
- The design system lives in `app/globals.css` (tokens) plus `components/` (`BrandLogo`, `BrandMark`, `LuxuryHeading`, `ProductCard`, `ProductListing`, `CampaignBanner`, `TrustBar`, `OrderPayment`, …).

## Key flows

### Order, stock and payment lifecycle

```
checkout ─► PENDING_PAYMENT  (stock RESERVED; payment PENDING)
   │  customer submits UTR / proof ─► payment SUBMITTED  (still unpaid)
   │  staff verifies against the bank statement ─► payment CAPTURED, order PAID (stock SOLD)
   │  staff rejects ─► payment back to PENDING with a reason shown to the customer
   │  hold expires (48 h manual / 30 min gateway, configurable) ─► CANCELLED, payment EXPIRED, stock RELEASED
   ▼
PAID ─► PROCESSING ─► PACKED ─► SHIPPED ─► OUT_FOR_DELIVERY ─► DELIVERED
                                                   │ customer requests return within the window
                                                   ▼
                                           RETURN_REQUESTED ─► RETURNED (restocked) | back to DELIVERED
refunds (any paid order) ─► payment PARTIALLY_REFUNDED / REFUNDED ─► order REFUNDED when fully refunded
```

- The transition table in `orders/order-lifecycle.ts` is the single source of truth.
- Staff can never set PAID or REFUNDED directly.
- Stock is reserved with a conditional `UPDATE … WHERE quantity - reserved >= qty`, so a single piece can't be oversold.
- Checkout is idempotent per `idempotencyKey`.
- Orders with a submitted UTR are never auto-expired.

### UPI QR

The original QR image is uploaded in Admin → Settings and stored in the database (`BusinessAsset`), not in a public folder. On upload the server:

- sniffs the file type from its bytes;
- decodes the QR;
- requires a `upi://pay` URI whose `pa` matches the configured UPI ID;
- records a SHA-256 fingerprint and an audit entry.

Customers receive the image only inside their own order's payment instructions. Generating an amount-prefilled UPI link is opt-in.

## Caching

- Redis caches settings (5 min), the category tree (10 min), active collections (5 min) and banners (2 min). Every admin write invalidates the affected key.
- If Redis is unavailable, reads fall through to the database.
- The storefront fetches settings with a 60-second revalidation.

## Deferred / future work

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md#deferred-and-why): guest checkout, a server-side cart, a background job queue, unique-item inventory, semantic/AI search, WhatsApp notifications and analytics providers.

The code is structured for these without claiming they are live:

- search goes through `SearchService`;
- notifications go through `NotificationsService`;
- payments go through the `PaymentGateway` interface.
