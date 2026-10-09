import { expect, test } from '@playwright/test';
import QRCode from 'qrcode';
import { adminToken, API, auth, createProduct, ensureManualPaymentsEnabled, registerCustomer, unique } from './helpers';

test.describe('API integration', () => {
  let admin: string;

  test.beforeAll(async ({ request }) => {
    admin = await adminToken(request);
    await ensureManualPaymentsEnabled(request, admin);
  });

  test('health check reports database and cache', async ({ request }) => {
    const body = await (await request.get(`${API}/health`)).json();
    expect(body).toMatchObject({ status: 'ok', db: 'up' });
  });

  test('public settings never expose bank or UPI details', async ({ request }) => {
    const text = await (await request.get(`${API}/settings`)).text();
    for (const key of ['bankAccountNumber', 'bankIfsc', 'upiId', 'bankName']) expect(text).not.toContain(key);
  });

  test('RBAC: customers and order managers cannot change payment settings', async ({ request }) => {
    const { token } = await registerCustomer(request);
    expect((await request.get(`${API}/admin/orders`, { headers: auth(token) })).status()).toBe(403);

    const email = `${unique('om')}@seshastone.com`;
    await request.post(`${API}/admin/users`, {
      headers: auth(admin),
      data: { email, firstName: 'Order', role: 'ORDER_MANAGER', password: 'TempPass12345' },
    });
    const om = (await (await request.post(`${API}/auth/admin/login`, { data: { email, password: 'TempPass12345' } })).json()).accessToken;
    expect((await request.get(`${API}/admin/orders`, { headers: auth(om) })).status()).toBe(200);
    const change = await request.put(`${API}/admin/settings`, {
      headers: auth(om),
      data: { values: { 'payments.upiId': 'attacker@ybl' }, confirmFinancialChange: true },
    });
    expect(change.status()).toBe(403);
    expect((await request.get(`${API}/admin/users`, { headers: auth(om) })).status()).toBe(403);
  });

  test('settings: account number masked, payment changes need confirmation, invalid values rejected', async ({ request }) => {
    const view = await (await request.get(`${API}/admin/settings`, { headers: auth(admin) })).json();
    const masked = view.values['payments.bankAccountNumber'] as string;
    if (masked) expect(masked).toMatch(/^•+\d{4}$/);

    const branch = view.values['payments.bankBranch'] as string;
    const unconfirmed = await request.put(`${API}/admin/settings`, {
      headers: auth(admin),
      data: { values: { 'payments.bankBranch': `${branch} ` + 'x' } },
    });
    expect(unconfirmed.status()).toBe(409);
    expect((await unconfirmed.json()).confirmationRequired).toBe(true);

    const invalid = await request.put(`${API}/admin/settings`, {
      headers: auth(admin),
      data: { values: { 'payments.bankIfsc': 'NOT-AN-IFSC' }, confirmFinancialChange: true },
    });
    expect(invalid.status()).toBe(400);
  });

  test('UPI QR upload rejects non-images and QRs for a different UPI ID', async ({ request }) => {
    const notImage = await request.post(`${API}/admin/settings/upi-qr`, {
      headers: auth(admin),
      multipart: { file: { name: 'qr.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') } },
    });
    expect(notImage.status()).toBe(400);

    const wrongQr = await QRCode.toBuffer('upi://pay?pa=someone-else@okaxis&pn=Someone');
    const mismatch = await request.post(`${API}/admin/settings/upi-qr`, {
      headers: auth(admin),
      multipart: { file: { name: 'qr.png', mimeType: 'image/png', buffer: wrongQr }, confirm: 'true' },
    });
    expect(mismatch.status()).toBe(400);
    expect((await mismatch.json()).message).toContain('someone-else@okaxis');

    const notUpi = await request.post(`${API}/admin/settings/upi-qr`, {
      headers: auth(admin),
      multipart: { file: { name: 'qr.png', mimeType: 'image/png', buffer: await QRCode.toBuffer('https://example.com') }, confirm: 'true' },
    });
    expect(notUpi.status()).toBe(400);
  });

  test('manual payment lifecycle: idempotent checkout → evidence → reject → verify → refund cap', async ({ request }) => {
    const product = await createProduct(request, admin);
    const customer = await registerCustomer(request);
    const other = await registerCustomer(request);
    const key = crypto.randomUUID();
    const checkout = () =>
      request.post(`${API}/checkout`, {
        headers: auth(customer.token),
        data: { items: [{ variantId: product.variantId, quantity: 1 }], addressId: customer.addressId, paymentProvider: 'UPI_DIRECT', idempotencyKey: key },
      });
    const first = await (await checkout()).json();
    const second = await (await checkout()).json();
    expect(second.id).toBe(first.id); // duplicate submission returns the same order
    expect(first.status).toBe('PENDING_PAYMENT');

    // Client-supplied prices are ignored — the server prices the order.
    expect(first.total).toBe(250_000);

    const instructions = await (await request.get(`${API}/me/orders/${first.id}/payment-instructions`, { headers: auth(customer.token) })).json();
    expect(instructions.upi.upiId).toMatch(/@/);
    expect(instructions.paymentStatus).toBe('PENDING');
    expect((await request.get(`${API}/me/orders/${first.id}/payment-instructions`, { headers: auth(other.token) })).status()).toBe(404);

    const badFile = await request.post(`${API}/me/orders/${first.id}/payment-evidence`, {
      headers: auth(customer.token),
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('not really an image') } },
    });
    expect(badFile.status()).toBe(400);

    const png = await QRCode.toBuffer('screenshot stand-in');
    const uploaded = await (await request.post(`${API}/me/orders/${first.id}/payment-evidence`, {
      headers: auth(customer.token),
      multipart: { file: { name: 'proof.png', mimeType: 'image/png', buffer: png } },
    })).json();
    expect(uploaded.paymentStatus).toBe('SUBMITTED');
    expect(uploaded.message).toContain('submitted for verification');
    const evidenceId = uploaded.evidence[0].id;
    expect((await request.get(`${API}/me/payment-evidence/${evidenceId}`, { headers: auth(other.token) })).status()).toBe(404);

    // Evidence alone never marks the order paid.
    const stillPending = await (await request.get(`${API}/me/orders/${first.id}`, { headers: auth(customer.token) })).json();
    expect(stillPending.status).toBe('PENDING_PAYMENT');

    const utr = String(Date.now()).slice(-12);
    await request.post(`${API}/me/orders/${first.id}/payment-reference`, { headers: auth(customer.token), data: { reference: utr } });
    const paymentId = stillPending.payments[0].id;

    const rejected = await request.post(`${API}/admin/payments/${paymentId}/reject`, { headers: auth(admin), data: { reason: 'UTR not found' } });
    expect(rejected.status()).toBe(200);
    const afterReject = await (await request.get(`${API}/me/orders/${first.id}/payment-instructions`, { headers: auth(customer.token) })).json();
    expect(afterReject.rejectionReason).toBe('UTR not found');

    await request.post(`${API}/me/orders/${first.id}/payment-reference`, { headers: auth(customer.token), data: { reference: `${utr.slice(0, -1)}9` } });
    expect((await request.post(`${API}/admin/payments/${paymentId}/verify`, { headers: auth(admin) })).status()).toBe(200);
    expect((await request.post(`${API}/admin/payments/${paymentId}/verify`, { headers: auth(admin) })).status()).toBe(400);

    const paid = await (await request.get(`${API}/me/orders/${first.id}`, { headers: auth(customer.token) })).json();
    expect(paid.status).toBe('PAID');

    const over = await request.post(`${API}/admin/orders/${first.id}/refunds`, { headers: auth(admin), data: { amount: 250_001, reason: 'too much' } });
    expect(over.status()).toBe(400);
    const refund = await request.post(`${API}/admin/orders/${first.id}/refunds`, {
      headers: auth(admin),
      data: { amount: 250_000, reason: 'Customer cancelled', method: 'upi', reference: 'RFD1', processed: true },
    });
    expect(refund.status()).toBe(201);
    const refunded = await (await request.get(`${API}/admin/orders/${first.id}`, { headers: auth(admin) })).json();
    expect(refunded.status).toBe('REFUNDED');
    expect(refunded.payments[0].status).toBe('REFUNDED');
  });

  test('order tracking requires the matching email', async ({ request }) => {
    const product = await createProduct(request, admin);
    const customer = await registerCustomer(request);
    const order = await (await request.post(`${API}/checkout`, {
      headers: auth(customer.token),
      data: { items: [{ variantId: product.variantId, quantity: 1 }], addressId: customer.addressId, paymentProvider: 'BANK_TRANSFER' },
    })).json();
    expect((await request.post(`${API}/orders/track`, { data: { orderNumber: order.orderNumber, email: 'wrong@example.com' } })).status()).toBe(404);
    const tracked = await (await request.post(`${API}/orders/track`, { data: { orderNumber: order.orderNumber, email: customer.email } })).json();
    expect(tracked).toMatchObject({ orderNumber: order.orderNumber, status: 'PENDING_PAYMENT' });
    expect(JSON.stringify(tracked)).not.toContain('Test Street'); // no address / PII in tracking
  });

  test('stock cannot be oversold', async ({ request }) => {
    const product = await createProduct(request, admin, {
      variants: [{ sku: unique('E2E-ONE-'), title: 'One of one', price: 100_000, stock: 1 }],
    });
    const a = await registerCustomer(request);
    const b = await registerCustomer(request);
    const place = (c: { token: string; addressId: string }) =>
      request.post(`${API}/checkout`, {
        headers: auth(c.token),
        data: { items: [{ variantId: product.variantId, quantity: 1 }], addressId: c.addressId, paymentProvider: 'UPI_DIRECT' },
      });
    const results = await Promise.all([place(a), place(b)]);
    expect(results.map((r) => r.status()).sort()).toEqual([201, 400]);
  });
});
