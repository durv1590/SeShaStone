import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_URL, adminToken, API, auth, createProduct, ensureManualPaymentsEnabled, unique } from './helpers';

/**
 * The master brief's end-to-end journey:
 * 1 home → 2 category → 3 product → 4 add to cart → 5 checkout → 6 delivery info → 7 UPI →
 * 8 order reference → 9 admin verifies payment → 10 customer sees status → 11 admin ships →
 * 12 customer tracks the order.
 */
test('customer purchase journey with manual UPI verification', async ({ page, browser, request }) => {
  const admin = await adminToken(request);
  await ensureManualPaymentsEnabled(request, admin);
  const product = await createProduct(request, admin, { name: `E2E Journey Anklet ${unique('').slice(-5)}` });
  const email = `${unique('journey')}@example.com`;

  // 1–3
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Silver', exact: true }).click();
  await expect(page).toHaveURL(/\/silver$/);
  await page.goto(`/product/${product.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();

  // 4
  await page.getByRole('button', { name: 'Add to Bag' }).click();
  await expect(page.getByRole('status')).toContainText('Added to your bag');

  // 5 — sign-up is required before checkout
  await page.getByRole('button', { name: 'Buy Now' }).click();
  await page.waitForURL(/\/login/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('First name').fill('Journey');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('secret1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/checkout/);

  // 6
  await page.getByLabel('Full name').fill('Journey Tester');
  await page.getByLabel('Mobile number').fill('+919876500000');
  await page.getByLabel('House no., street').fill('12 Civil Lines');
  await page.getByLabel('City', { exact: true }).fill('Jalandhar');
  await page.getByLabel('State', { exact: true }).fill('Punjab');
  await page.getByLabel('PIN code').fill('144001');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.locator('.radio-card', { hasText: 'Journey Tester' })).toBeVisible();

  // 7
  await page.locator('.radio-card', { hasText: 'Pay with any UPI app' }).click();
  await expect(page.getByText('Includes GST')).toBeVisible();
  await page.getByRole('button', { name: 'Place order' }).click();

  // 8
  await page.waitForURL(/\/account\/orders\//);
  await expect(page.getByText('has been placed')).toBeVisible();
  const orderNumber = (await page.getByRole('heading', { name: /^Order SSS-/ }).textContent())!.replace('Order ', '').trim();
  // The UPI ID shown comes from Admin → Settings; just check payment details are displayed.
  await expect(page.locator('.kv dd').first()).toContainText('@');
  await page.getByPlaceholder('e.g. 427812345678').fill(String(Date.now()).slice(-12));
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('submitted for verification')).toBeVisible();

  // 9 — staff verifies in the admin panel
  const staff = await browser.newPage();
  staff.on('dialog', (d) => d.accept());
  await staff.goto(`${ADMIN_URL}/login`);
  await staff.getByLabel('Email').fill(ADMIN_EMAIL);
  await staff.getByLabel('Password').fill(ADMIN_PASSWORD);
  await staff.getByRole('button', { name: 'Sign in' }).click();
  await staff.waitForSelector('text=Payments to verify');
  await staff.goto(`${ADMIN_URL}/payments?status=SUBMITTED`);
  await staff.getByRole('row', { name: new RegExp(orderNumber) }).getByRole('button', { name: 'Verify payment' }).click();
  await expect(staff.getByRole('row', { name: new RegExp(orderNumber) })).toHaveCount(0);

  // 10
  await page.reload();
  await expect(page.locator('.status').first()).toHaveText(/Confirmed/i);

  // 11 — ship via the API as staff
  const orders = await (await request.get(`${API}/admin/orders?q=${orderNumber}`, { headers: auth(admin) })).json();
  const orderId = orders.items[0].id;
  for (const status of ['PROCESSING', 'PACKED']) {
    await request.patch(`${API}/admin/orders/${orderId}/status`, { headers: auth(admin), data: { status } });
  }
  await request.patch(`${API}/admin/orders/${orderId}/status`, {
    headers: auth(admin),
    data: { status: 'SHIPPED', trackingNumber: 'E2E-TRACK-1', courier: 'Blue Dart' },
  });

  // 12
  await page.goto('/order-tracking');
  await page.getByLabel('Order number').fill(orderNumber);
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: 'Track order' }).click();
  await expect(page.getByText('E2E-TRACK-1')).toBeVisible();
  await expect(page.locator('.status')).toHaveText(/Shipped/i);
});
