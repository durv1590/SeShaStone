# Database

PostgreSQL via Prisma. Schema: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Migrations: `apps/api/prisma/migrations`.

## Conventions

- **Money** is stored as **integer paise** (`Int`) everywhere: prices, totals, refunds, shipping. There is no floating-point arithmetic. GST is extracted from GST-inclusive prices with integer rounding.
- **Weights and carats** use `Decimal`.
- IDs are `cuid()`. Every table has `createdAt` and, where mutable, `updatedAt`.
- Financial records (orders, payments, refunds, audit log) are never deleted by the application.

## Entities

| Area | Models |
| --- | --- |
| Identity | `Customer` (customers and staff; `role`), `Address`, `PasswordResetToken` (stores only the SHA-256 hash of the token) |
| Catalogue | `Product` (`line`: GOLD / SILVER / DIAMOND / ARTIFICIAL, plus verified attributes), `ProductVariant` (SKU, size, gross/net weight, price, MRP, GST rate), `ProductImage`, `Category` (tree), `Collection` (MANUAL / NEWEST / BESTSELLING; many-to-many with products) |
| Inventory | `InventoryItem` (quantity, reserved, low-stock threshold, one per variant), `InventoryMovement` (RESTOCK, ADJUSTMENT, RESERVE, RELEASE, SALE, RETURN) |
| Orders | `Order` (address, billing and contact snapshots, `idempotencyKey`, shipped/delivered timestamps), `OrderItem` (product/SKU/price snapshots), `ReturnRequest` |
| Payments | `Payment` (provider, status, UTR, submitted/verified info, rejection reason, refunded amount), `PaymentEvidence` (private bytes + SHA-256), `Refund` |
| Marketing | `Coupon`, `CouponUsage`, `Review` (verified purchasers), `WishlistItem`, `Banner` (campaigns: desktop/tablet/mobile images, CTA, theme, schedule), `CmsPage`, `NewsletterSubscriber`, `Campaign` |
| Configuration | `Setting` (key → JSON; see [BUSINESS_SETTINGS_GUIDE.md](BUSINESS_SETTINGS_GUIDE.md)), `BusinessAsset` (UPI QR image + decoded value) |
| Operations | `AuditLog`, `Notification` |

## Key constraints and indexes

- Unique:
  - customer email and phone
  - product and category slugs
  - variant SKU
  - `Order.orderNumber`
  - `(Order.customerId, idempotencyKey)`
  - `Payment.providerOrderId`
  - `(Review.productId, customerId)`
  - `(WishlistItem.customerId, productId)`
  - `CouponUsage.orderId`
- Indexed: order status and customer; payment status; product line/status/category; audit log by entity and date; notifications by order.

## Migrations

```bash
npm run db:migrate                      # development: create/apply migrations
npm run prisma:deploy -w @seshastone/api  # production: apply committed migrations only
npm run db:seed                         # idempotent seed
```

- `20260930112501_init`: the base schema.
- `20260930113730_manual_payments`: the UPI_DIRECT and BANK_TRANSFER providers.
- `20260930130000_master_brief`:
  - adds lines, attributes, collections, evidence, refunds, returns, audit, notifications, business assets, reset tokens, staff roles, and the new order and payment states;
  - backfills each existing product's `line` from its metal, gemstone and category.
- `20260930131000_order_timestamps`: shipped/delivered times.

Create new migrations with `prisma migrate dev --name <change>`. If the command refuses in a non-interactive shell, use `prisma migrate diff --from-migrations … --to-schema-datamodel … --script`. Review the generated SQL before committing.

## Backups

Use managed PostgreSQL with point-in-time recovery. Take a daily logical backup (`pg_dump -Fc`) as well, keep it for at least 30 days, and do a monthly restore drill. See [DEPLOYMENT.md](DEPLOYMENT.md#backups).
