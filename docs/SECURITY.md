# Security

## Controls in place

| Area | Control |
| --- | --- |
| Authentication | bcrypt (cost 12) password hashes. JWT bearer tokens. Uniform login timing. Password reset tokens are random, stored only as SHA-256, single-use and expire after 30 minutes. Reset requests never reveal whether an account exists |
| Authorisation | Role → permission map (`common/auth/permissions.ts`). Every admin route declares `@RequirePermissions`. Payment settings need a separate permission plus explicit confirmation. At least one Super Admin must remain; staff cannot change their own role |
| Rate limiting | 120 requests/min per IP globally. 5/min for login and registration, 3/min for forgot-password, 10/min for checkout and tracking, 5/min for evidence uploads |
| Input validation | class-validator on every DTO with whitelisting (unknown fields rejected). Typed per-key validation for settings. Banner links limited to site paths or `https://` (no `javascript:`). Open-redirect-safe `?next=` |
| Pricing | The server recalculates prices, stock, coupons and shipping at checkout. Client prices are never trusted. Money is integer paise |
| Stock | Conditional reservation (`quantity - reserved >= qty`) prevents overselling. Idempotent checkout |
| Payments | A manual payment is marked paid only after staff verification. Evidence never confirms payment on its own. Duplicate UTRs are rejected. Gateway webhooks are HMAC-SHA256 verified over the raw body and are idempotent. No card, CVV, UPI PIN, OTP or banking credential is requested or stored |
| File uploads | Type detected from magic bytes (the declared MIME type is ignored). Size limits (QR 2 MB, evidence 5 MB, 3 files). Evidence stored privately in the database. Served with `nosniff`, `no-store` and a restrictive CSP. Owner-or-staff access only |
| UPI QR | Decoded server-side and accepted only when it pays the configured UPI ID. Stored unmodified. SHA-256 fingerprint. Served only in the owner's payment instructions |
| Sensitive data | Bank and UPI details are never in public endpoints, the footer or git. The account number is masked in admin with an audited reveal, and masked in audit logs |
| Headers | Helmet on the API (CSP, HSTS, frame-ancestors…). Storefront: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`; `poweredByHeader` off |
| SQL injection / XSS | Prisma parameterised queries (raw SQL uses tagged templates). React escaping. JSON-LD escapes `<` |
| Audit | Append-only `AuditLog` for settings, reveals, QR changes, payment verify/reject, refunds, order status, products, collections and staff: actor, IP, user agent, before and after |

## Operational rules

- Keep secrets in the hosting provider's secret store. Rotate `JWT_SECRET` if it is ever exposed (this signs everyone out).
- Staff each use their own account. Disable leavers immediately in **Staff & roles**.
- Restrict the admin domain (Cloudflare Access or an IP allow-list) in production.
- Review the audit log weekly, and after any payment-detail change.
- Keep dependencies patched (`npm audit`, Dependabot).
- Customer JWTs live in `localStorage`, which is simple and CSRF-proof but exposed to XSS. Before scaling, consider moving to `httpOnly` cookies with CSRF tokens.

## Known limitations

- Two-factor authentication for staff is not implemented yet; this is recommended before launch at scale.
- A proper CSP for the Next.js apps (nonce-based) is not configured yet.
- There is no malware scanning of uploaded evidence. Files are type-checked and never executed, and staff open them in a sandboxed blob tab.

## Reporting

Report vulnerabilities privately to the support email in Admin → Settings. Do not open public issues.
