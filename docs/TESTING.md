# Testing

| Command | What it runs |
| --- | --- |
| `npm run lint` | ESLint for api, web and admin (zero warnings allowed) |
| `npm run typecheck` | `tsc --noEmit` for all apps |
| `npm test` | API unit tests (Jest): pricing and GST, shipping, order transitions, refund caps, coupon maths, UPI QR decoding/parsing, file sniffing, masking |
| `npm run build` | Production builds of all three apps |
| `npm run test:e2e` | Playwright suite in `e2e/` (needs the full stack running) |

## End-to-end suite (`e2e/`)

1. Start the stack with the seeded Super Admin and a UPI ID / QR configured:

   ```bash
   docker compose up -d
   npm run db:migrate && npm run db:seed
   E2E_DISABLE_RATE_LIMIT=true npm run dev:api   # test runs register many customers from one IP
   npm run dev:web
   npm run dev:admin
   ```

2. Run the tests:

   ```bash
   npm run test:e2e
   # CHROMIUM_PATH=/path/to/chrome npm run test:e2e   # to use a preinstalled browser
   ```

| Spec | Covers |
| --- | --- |
| `api.spec.ts` | Health; the public settings leak check; RBAC (customer and Order Manager); account masking; financial confirmation; settings validation; the QR upload validator (non-image, non-UPI, different UPI ID); the whole manual payment lifecycle (idempotent checkout, server pricing, private evidence, reject with reason, single verify, refund cap, fully refunded state); tracking privacy; oversell protection under concurrency |
| `journey.spec.ts` | The brief's 12-step journey: home → category → product → bag → sign-up → address → UPI → order reference and UTR → admin verifies → customer sees confirmed → shipment → public tracking |
| `responsive.spec.ts` | No horizontal overflow on 12 pages at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px |
| `accessibility.spec.ts` | axe-core WCAG 2.1 A/AA (serious and critical) on key pages; keyboard access to the mega menu |

Tests create their own products and customers (prefixed `e2e`/`E2E`), so they never depend on demo data. Run them against a staging database, not production.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

- **checks:** lint, typecheck, unit tests and production builds.
- **e2e:** starts Postgres and Redis, migrates and seeds a fresh database, builds and starts the API, storefront and admin, then runs the Playwright suite. Server logs and Playwright traces are kept when it fails.

The e2e job uses test-only `SEED_*` values defined in the workflow (for example `ci-test@upi` and account `12345678901`). Never put real business, bank or UPI details in the workflow or in GitHub secrets for CI.

## Manual checks before release

- Real devices: iOS Safari and Android Chrome (checkout, the UPI app hand-off, file upload).
- Screen reader pass (VoiceOver / NVDA) through the header, product page and checkout.
- Visual review of every campaign banner at desktop, tablet and mobile sizes.
- A real ₹1 UPI payment and a real bank transfer, verified end to end.
