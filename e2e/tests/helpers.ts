import { APIRequestContext, expect } from '@playwright/test';

export const API = (process.env.E2E_API_URL ?? 'http://localhost:4000') + '/api/v1';
export const STORE = process.env.E2E_STORE_URL ?? 'http://localhost:3000';
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:3001';
export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@seshastone.com';
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

export const unique = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function adminToken(request: APIRequestContext) {
  const res = await request.post(`${API}/auth/admin/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.status(), 'seeded admin must be able to log in').toBe(200);
  return (await res.json()).accessToken as string;
}

export async function registerCustomer(request: APIRequestContext) {
  const email = `${unique('e2e')}@example.com`;
  const res = await request.post(`${API}/auth/register`, { data: { email, password: 'secret1234', firstName: 'E2E' } });
  expect(res.status()).toBe(201);
  const token = (await res.json()).accessToken as string;
  const address = await request.post(`${API}/me/addresses`, {
    headers: auth(token),
    data: { fullName: 'E2E Customer', phone: '+919876543210', line1: '1 Test Street', city: 'Jalandhar', state: 'Punjab', pincode: '144001' },
  });
  return { email, token, addressId: (await address.json()).id as string };
}

/** Creates an ACTIVE product with stock so tests never depend on demo data. */
export async function createProduct(request: APIRequestContext, admin: string, overrides: Record<string, unknown> = {}) {
  const slugBase = unique('e2e-piece-');
  const res = await request.post(`${API}/admin/products`, {
    headers: auth(admin),
    data: {
      name: `E2E Test Pendant ${slugBase.slice(-6)}`,
      slug: slugBase,
      status: 'ACTIVE',
      line: 'SILVER',
      metal: 'SILVER',
      purity: '925',
      tags: ['e2e'],
      variants: [{ sku: slugBase.toUpperCase(), title: 'Standard', price: 250_000, stock: 50 }],
      ...overrides,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const product = await res.json();
  return { id: product.id as string, slug: product.slug as string, variantId: product.variants[0].id as string, name: product.name as string };
}

export async function ensureManualPaymentsEnabled(request: APIRequestContext, admin: string) {
  const res = await request.put(`${API}/admin/settings`, {
    headers: auth(admin),
    data: { values: { 'payments.enabledProviders': ['UPI_DIRECT', 'BANK_TRANSFER'] }, confirmFinancialChange: true },
  });
  expect(res.status()).toBe(200);
}
