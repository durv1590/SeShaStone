# Go-live checklist

## Business and legal

- [ ] Replace every **draft** policy page (Admin → Banners & CMS): privacy, terms, shipping, cancellation, returns, refunds, payment, FAQs. Legal review done. (Draft pages are noindexed and show a banner until the `DRAFT —` paragraph is removed.)
- [ ] Confirm the trust messages (Settings → Storefront) are backed by real policies: authentic jewellery, pan-India delivery, easy returns…
- [ ] GSTIN, business address and contact details entered in Settings.
- [ ] A grievance officer / contact details as required for Indian e-commerce.

## Payments

- [ ] Bank account holder name confirmed **exactly** against SBI records.
- [ ] Account number, IFSC and branch re-checked in Settings (use Reveal).
- [ ] UPI ID set, and the original QR uploaded with the **Matches UPI ID setting** badge showing.
- [ ] Test ₹1 via the QR and via the UPI ID; test a small bank transfer. Verify both in Admin → Payments.
- [ ] Decide whether personal UPI limits are acceptable, or switch to a merchant UPI or gateway.
- [ ] Refund process agreed; refund instructions filled in.
- [ ] Payment methods enabled: only those you will actually support.

## Brand and catalogue

- [x] Final logo generated in `apps/web/public/brand/` (`npm run brand:generate`).
- [ ] Logo files sent to your printer or packaging supplier, if needed (the SVGs in `apps/web/public/brand/logo/` are print-ready vectors).
- [ ] Trademark search and registration for the name and monogram (a legal step; not covered by this build).
- [ ] Real product photography uploaded; no demo products (`SEED_DEMO_PRODUCTS=false`; delete any `DEMO-` SKUs).
- [ ] Every live product has a line, verified material details, weight, price and stock.
- [ ] Home hero and campaign banners uploaded in all three sizes.

## Technical

- [ ] `NODE_ENV=production`; strong `JWT_SECRET`; `CORS_ORIGINS` set to the production origins only.
- [ ] Migrations applied with `prisma migrate deploy`; seed run once.
- [ ] Seeded admin password changed; staff accounts created with least-privilege roles; the admin domain restricted.
- [ ] SMTP configured and a test email received. Otherwise, accept that notifications are SKIPPED.
- [ ] HTTPS everywhere; HSTS; Cloudflare WAF and bot protection on.
- [ ] Backups (PITR and nightly dumps) enabled; a restore drill done.
- [ ] Uptime monitor on `/api/v1/health`; error tracking connected.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build` pass; `npm run test:e2e` passes against staging.
- [ ] `robots.txt` and `sitemap.xml` reachable; Search Console verified with the sitemap submitted; `NEXT_PUBLIC_SITE_URL` correct.
- [ ] Real-device checks from [TESTING.md](TESTING.md#manual-checks-before-release).
