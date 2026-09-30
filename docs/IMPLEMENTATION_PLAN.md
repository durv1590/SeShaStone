# Implementation plan: master brief audit

This document maps the master brief against what the repository already contains. It records what this phase builds, and what is deliberately deferred and why.

## Phase 1: repository audit

| Area | Found | Verdict |
| --- | --- | --- |
| Framework | npm-workspaces monorepo: `apps/api` (NestJS 11 + Prisma 6 + PostgreSQL + Redis), `apps/web` (Next.js 15 storefront), `apps/admin` (Next.js 15 admin panel) | **Keep.** It matches the brief's preferred stack. The admin stays a separate app rather than `web/app/admin` so admin code never ships to shoppers. |
| Brand reference | `brand/seshastone-brand-reference.png` | Present |
| Logo assets | None. There is no approved logo file; the SS monogram in `apps/web/components/brand.tsx` is our approximation | Build a placeholder SVG logo system, **clearly labelled as temporary** |
| UPI QR | `public/payment/upi-qr/current-upi-qr.png`: the original PhonePe QR. It decodes to a `upi://pay` URI whose UPI ID matches the configured one | Present and verified |
| Database | 20 models: customers, addresses, categories, products/variants/images, inventory and movements, orders and items, payments, coupons and usage, reviews, wishlist, CMS pages, banners, newsletter, campaigns, key-value settings | Extend. Do not replace |
| Payments | Direct UPI (QR generated from the configured UPI ID), bank transfer, customer UTR submission, admin confirm/reject, stock hold and expiry, and Razorpay/Cashfree adapters with HMAC webhooks (not activated) | Rework the QR handling to use the uploaded original QR; add evidence upload, refunds and new states |
| Settings | Database key-value store with a Redis cache; bank and UPI details are never exposed publicly | Add branch, WhatsApp, address, instructions and refund fields, account-number masking, confirmation for financial changes, and an audit trail |
| Auth | JWT with roles CUSTOMER / STAFF / ADMIN | Add fine-grained RBAC, rate limiting, password reset and security headers |

## Decisions

1. **Settings storage.** Keep the existing key-value `Setting` table. It is already the single, cached, database-backed configuration source, and it avoids a migration per new field. Every key has a typed default in `settings.service.ts`.
2. **UPI QR.** The original QR image is stored in the database (`BusinessAsset`), not in a public web folder. It is sent to a customer only inside their own order's payment instructions. When it is uploaded, the server decodes it and rejects anything that is not a `upi://pay` QR. The admin sees the decoded payee, plus a warning if it doesn't match the configured UPI ID. Generating an amount-filled QR or a UPI deep link from the typed UPI ID is **off by default**; an admin can enable it after verifying it.
3. **Jewellery line.** Add `Product.line`: GOLD / SILVER / DIAMOND / ARTIFICIAL. This keeps real precious-metal pieces clearly separate from artificial ones, while subcategories (rings, earrings…) stay ordinary categories. That gives URLs like `/gold/rings`.
4. **Money.** Integer paise everywhere, as before, so there is no floating-point arithmetic.
5. **Emails.** A `Notification` record is written for every customer message. It is sent through SMTP only when `SMTP_*` is configured; otherwise it is recorded as `SKIPPED`, never shown as sent.

## Built in this phase

- **Payments:** original-QR upload and validation; evidence upload (PNG/JPEG/PDF, 5 MB, checked by content, visible only to the owner and admins); payment states `SUBMITTED` / `EXPIRED` / `PARTIALLY_REFUNDED`; a refunds module; a return-request workflow; branch and full copy buttons.
- **Orders:** statuses `PACKED`, `OUT_FOR_DELIVERY`, `RETURN_REQUESTED` and `RETURNED`; idempotent checkout against duplicate submissions; billing address; public order tracking.
- **Admin:** RBAC with SUPER_ADMIN, ADMIN, ORDER_MANAGER, PRODUCT_MANAGER, MARKETING_MANAGER, SUPPORT (plus legacy STAFF); staff user management; audit log and viewer; payment settings screen (mask, reveal, confirm, change history); refunds; collections; campaign banners with desktop, tablet and mobile images.
- **Catalogue:** jewellery line plus line-specific attributes (hallmark, finish, plating, diamond carat/cut/colour/clarity, certificate, care); collections (manual / newest / bestselling); SEO routes `/gold`, `/gold/rings`, `/collections/bridal`, `/product/[slug]`, `/search`.
- **Storefront:** utility bar, mega menu, mobile drawer, redesigned home page, product gallery and specifications, wishlist page, account pages, forgot/reset password, draft policy pages.
- **SEO:** metadata, canonical URLs, Open Graph, `sitemap.xml`, `robots.txt`, and JSON-LD for Organization, WebSite, Product and BreadcrumbList.
- **Security:** Helmet headers, rate limiting (strict on auth and order tracking), upload validation by magic bytes, and audit logging.
- **Quality:** ESLint, unit tests, a Playwright end-to-end suite, and a responsive overflow check at the nine required widths.
- **Docs:** the twelve documents listed in the brief.

## Deferred, and why

| Item | Reason |
| --- | --- |
| Product photography, campaign and packaging artwork | Needs real photos of real pieces; the brief forbids fabricated jewellery imagery. Placeholders plus admin upload are provided. |
| Final logo files | No approved logo was supplied. The SVG system is marked as temporary. |
| Guest checkout, server-side cart | Needs a verified email/OTP channel to secure guest order access. Requires an email or SMS provider first. |
| Background job queue (BullMQ) | Notifications are sent in-process with persisted status. A queue becomes worthwhile once a provider is live. |
| Partially-paid state, unique-item inventory mode | Need business rules (how short payments are handled, serial-number tracking) before they can be modelled. |
| Semantic / AI search | Architecture only (Meilisearch index already in place); not claimed as live. |
| WhatsApp notifications, analytics provider | Integration points documented; no provider credentials exist. |
