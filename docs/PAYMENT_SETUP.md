# Payment setup

SeSha Stone supports three kinds of payment:

| Method | Status | How money is confirmed |
| --- | --- | --- |
| **UPI** (store UPI ID / QR) | Live | Staff verify the UTR against the UPI statement |
| **Bank transfer** (NEFT / IMPS to the SBI account) | Live | Staff verify the UTR against the bank statement |
| Razorpay / Cashfree gateway | Built, **not activated** | Signed webhook from the gateway |
| Cash on delivery | Optional (off) | Marked paid when delivered |

The system never asks customers for a UPI PIN, OTP, card number, CVV or banking password, and never stores them.

## 1. Enter bank and UPI details

These live in Admin → Settings → **Payment information**, never in code or in git. You need the `settings.payment.edit` permission (Super Admin or Admin).

1. Bank name, account holder, account number, IFSC and branch.
   - The account holder must match the bank's records exactly (the brief requires this check before launch).
2. UPI ID and payee name.
3. Tick **UPI** and **Bank transfer** under Payment methods.
4. Save, then confirm the prompt. The change is written to the change history.

For a fresh install you can also pre-fill these from the untracked `apps/api/.env` (the `SEED_*` variables) with `npm run db:seed`. The seed never overwrites values already saved in the admin panel.

## 2. Upload the original UPI QR

1. Admin → Settings → **UPI QR code** → choose the QR image exported from your UPI app (PNG or JPEG, up to 2 MB).
2. The server decodes it and rejects it if:
   - it is not a UPI payment QR;
   - it pays a different UPI ID than the one saved in step 1.
3. Confirm the prompt showing who customers will pay. The original image is stored unmodified.

The panel shows the decoded UPI ID, the payee name, the account type (personal P2P or merchant) and a **Matches UPI ID setting** badge. If the UPI ID is changed later, the QR stops matching and is hidden from customers until a matching QR is uploaded.

**Notes on personal UPI IDs:**

- Personal (P2P) UPI IDs have per-transaction and daily limits set by the bank and app, often around ₹1,00,000 per transaction. Customers buying high-value pieces may need bank transfer.
- A merchant / business UPI ID raises these limits.

Optionally, enable **"Open UPI app" link with the amount pre-filled**. It generates a `upi://pay` link from the UPI ID. Enable it only after test-paying a small amount with it.

## 3. Daily verification workflow

1. Admin → **Payments** → "To verify" lists orders where the customer submitted a UTR or uploaded proof.
2. Open your bank or UPI statement and find a credit that matches both the **amount** and the **UTR**. Bank transfers also carry the order number in the remarks.
3. Click **Verify payment**. The order becomes *Confirmed* and its stock is converted to a sale. The customer is notified if email is configured.
4. If you can't find the payment, click **Reject** with a reason. The customer sees the reason and can submit the correct UTR.

A screenshot alone is never proof. Always match the statement. Unpaid manual orders hold stock for 48 hours (configurable); orders with a submitted UTR are never auto-cancelled.

## 4. Refunds

1. Send the money from your bank or UPI first.
2. In the order: **Refunds** → amount, method, reference (UTR), reason → **Record refund**. Tick "Already paid out" if you have already sent it. Otherwise record it as pending and later click **Mark paid out**.
3. Refunds can never exceed the verified amount received. A full refund marks the payment and the order as refunded.

## 5. Activating a payment gateway (optional, later)

1. Open an account with an RBI-authorised payment aggregator (e.g. Razorpay or Cashfree) and complete KYC.
2. Set the server environment variables:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or
   - `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV=production`.
3. Register the webhook `https://<api-host>/api/v1/payments/webhooks/razorpay` (or `/cashfree`).
4. Tick the gateway under Payment methods. Until the keys exist, the gateway reports "not configured" and cannot be used.

Webhooks are HMAC-verified and idempotent (a replay is ignored). Card data never touches this system.
