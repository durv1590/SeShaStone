# Admin guide

The admin panel runs at `https://admin.seshastone.com` (locally `http://localhost:3001`). Staff sign in with their own accounts. The menu shows only what your role allows, and the API enforces the same rules.

## Roles

| Role | Can |
| --- | --- |
| **Super Admin** | Everything, including creating staff and assigning roles |
| **Admin** | Everything except managing staff accounts |
| **Order Manager** | Orders, payment verification, refunds, customers (view), products (view) |
| **Product Manager** | Products, categories, inventory, image upload, reviews |
| **Marketing Manager** | Coupons, campaigns and banners, CMS pages, collections content, newsletter, reviews |
| **Customer Support** | View orders, payments, customers, products; moderate reviews |

Manage staff in **Staff & roles**. At least one active Super Admin must always exist, and you cannot change your own role.

## Everyday tasks

- **Dashboard:**
  - revenue, orders and orders to fulfil;
  - payments to verify, awaiting payment and verified payments;
  - refunds and returns;
  - customers, products, low stock and active campaigns.
- **Payments → To verify:** see [PAYMENT_SETUP.md](PAYMENT_SETUP.md#3-daily-verification-workflow). Proof files open in a new tab and are visible only to staff and the customer who uploaded them.
- **Orders:** move each order through *Start processing → Mark packed → Mark shipped* (enter the tracking number and courier) *→ Out for delivery → Mark delivered*.
  - The buttons only offer valid next steps.
  - Cancelling a paid order restocks it; then record a refund.
- **Returns:**
  - Customers request returns from their order page within the return window.
  - Choose *Return received (restock)* or *Reject return*, then record a refund if appropriate.
- **Products:**
  - Every live product needs a **jewellery line**.
  - Line-specific fields appear for the line you pick (for example the hallmark HUID for gold, or plating and base material for premium artificial).
  - Fill in only verified details; every filled field is shown to customers.
  - Use real photographs of the exact piece.
  - **Photos:** drop several at once or click **Add photos**. Each is rotated upright, resized to 2000px on its longest side and compressed in your browser before uploading, so phone photos of several MB become a few hundred KB. A note warns if a photo is under 1000px on its short side. The first photo is the main image: drag photos or use the arrows to reorder them, and fill in each photo's alt text (what it shows, e.g. "Necklace worn, front view"). iPhone HEIC photos open only in Safari; elsewhere, export them as JPEG or set the camera to "Most Compatible".
- **Inventory:** adjust stock with a reason; every change is logged. Filter to low stock.
- **Collections:** hand-picked collections (assign products on the product page) or automatic ones (newest, bestselling).
- **Banners & CMS:**
  - Campaigns take desktop (1920×700), tablet (1280×700) and mobile (1080×1350) images, a button label, a link (a site path or https URL only), a theme, a priority and start/end dates.
  - Policy pages (privacy, terms, shipping, cancellation, returns, refunds, payment, FAQs, contact) are seeded with the store's policies. Edit them here when a policy changes; the seed never overwrites a page you have edited. In page text, a blank line starts a new paragraph, "## " starts a heading and lines starting with "- " form a list.
- **Settings:** see [BUSINESS_SETTINGS_GUIDE.md](BUSINESS_SETTINGS_GUIDE.md).
- **Audit log:** every settings change, account-number reveal, payment verification or rejection, refund, order status change, product change and staff change, with who, when and from which IP.

## Notifications

Order, payment, shipping and refund emails are sent only when SMTP is configured (see [DEPLOYMENT.md](DEPLOYMENT.md) → Email). Each order page lists every notification with its status. **SKIPPED** means no email provider is configured; nothing was sent. **FAILED** shows the provider's error.

**Admin → Settings → Email** shows whether email is connected, which server it uses and the address it sends as. **Check connection** re-tests the login; **Send test email** (Admin and Super Admin) sends a test to you or to an address you enter, and is recorded in the audit log.
