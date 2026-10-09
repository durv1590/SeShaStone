# Business settings guide

All business, contact and payment information is **data, not code**:

- It is stored in the `Setting` table, cached for up to 5 minutes and invalidated on save.
- Every key has a typed validator (email, phone, IFSC, account number, UPI ID, URL, GSTIN…).
- Unknown keys are rejected.

Edit it in Admin → **Settings**. The source of truth is `apps/api/src/settings/settings.service.ts` (`SETTING_DEFAULTS`).

| Section | Keys | Who can edit | Where it appears |
| --- | --- | --- | --- |
| Business information | `store.name`, `store.legalName`, `store.website`, `store.supportEmail`, `store.supportPhone`, `store.whatsapp`, `store.address`, `store.gstin` | settings.business.edit | Utility bar, footer, Contact, structured data |
| Storefront | `store.announcement`, `store.instagram`, `store.facebook`, `store.youtube`, `store.trustPoints` | settings.business.edit | Announcement bar, footer, trust bar |
| Shipping, checkout, returns | `shipping.flatRate`, `shipping.freeAbove` (paise), `checkout.codEnabled`, `checkout.pendingOrderTtlMinutes`, `checkout.manualPaymentHoldHours`, `returns.windowDays` | settings.business.edit | Cart, checkout, product page, order holds |
| **Payment information** | `payments.enabledProviders`, `payments.bankName`, `payments.bankAccountName`, `payments.bankAccountNumber`, `payments.bankIfsc`, `payments.bankBranch`, `payments.bankInstructions`, `payments.upiId`, `payments.upiPayeeName`, `payments.upiInstructions`, `payments.upiGeneratedQrEnabled`, `payments.refundInstructions` | settings.payment.edit **+ confirmation** | Customer's own payment page only |
| UPI QR | stored as `BusinessAsset` `upi-qr` | settings.payment.edit + confirmation | Customer's own payment page only |

## Privacy rules

- The public `/settings` endpoint exposes only the keys in `PUBLIC_SETTING_KEYS`. Bank and UPI details are never included.
- The account number is masked in the admin panel (`•••••••1234`). **Reveal** shows it once and records who revealed it.
- Audit entries mask the account number in both *before* and *after*.
- Bank and UPI details are shown only to a signed-in customer, on the payment page of their own unpaid UPI or bank-transfer order.

## Secrets are not settings

API keys and credentials live only in server environment variables, never in the database or git:

- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `S3_*`
- `SMTP_*`
- `RAZORPAY_*` / `CASHFREE_*`

## Seeding a new environment

Put the values in the untracked `apps/api/.env`:

```
SEED_STORE_LEGAL_NAME=
SEED_STORE_WEBSITE=
SEED_STORE_EMAIL=
SEED_STORE_PHONE=
SEED_STORE_WHATSAPP=
SEED_UPI_ID=
SEED_UPI_PAYEE_NAME=
SEED_BANK_NAME=
SEED_BANK_ACCOUNT_NAME=
SEED_BANK_ACCOUNT_NUMBER=
SEED_BANK_IFSC=
SEED_BANK_BRANCH=
SEED_UPI_QR_PATH=   # defaults to public/payment/upi-qr/current-upi-qr.png
```

Then run `npm run db:seed`. The seed only fills keys that are not already set. The QR is imported only if it decodes to a UPI payment URI.
