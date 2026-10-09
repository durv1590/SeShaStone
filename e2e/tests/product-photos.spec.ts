import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_URL, adminToken, API, auth, createProduct, STORE } from './helpers';

/**
 * Admin photo manager: a full-size phone photo is shrunk and converted in the browser before upload,
 * photos can be reordered and given alt text, and the result shows on the storefront.
 */
test('product photos are resized, reordered and saved with alt text', async ({ page, request }) => {
  const token = await adminToken(request);
  const product = await createProduct(request, token);

  await page.goto(`${ADMIN_URL}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('text=Payments to verify');
  await page.goto(`${ADMIN_URL}/products/${product.id}`);

  // Two large "photos" (2400×3200 JPEG, like a phone camera at reduced size), drawn in the browser.
  const encoded = await page.evaluate(async () => {
    const make = async (hue: number) => {
      const c = document.createElement('canvas');
      c.width = 2400;
      c.height = 3200;
      const ctx = c.getContext('2d')!;
      const g = ctx.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, `hsl(${hue} 40% 85%)`);
      g.addColorStop(1, `hsl(${hue + 40} 50% 35%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `hsl(${(hue + i) % 360} 60% ${30 + (i % 50)}%)`;
        ctx.beginPath();
        ctx.arc((i * 97) % c.width, (i * 61) % c.height, 6 + (i % 30), 0, Math.PI * 2);
        ctx.fill();
      }
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.97));
      const dataUrl = await new Promise<string>((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result as string);
        reader.readAsDataURL(blob);
      });
      return dataUrl.split(',')[1];
    };
    return Promise.all([make(30), make(160)]);
  });
  const photos = encoded.map((b64) => Buffer.from(b64, 'base64'));
  expect(photos[0].length).toBeGreaterThan(500 * 1024);

  await page.getByLabel('Add product photos').setInputFiles([
    { name: 'front.jpg', mimeType: 'image/jpeg', buffer: photos[0] },
    { name: 'side.jpg', mimeType: 'image/jpeg', buffer: photos[1] },
  ]);
  const tiles = page.getByRole('list', { name: /Product photos/ }).getByRole('listitem');
  await expect(tiles).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByText(/front\.jpg: [\d.]+ (MB|KB) → [\d.]+ (MB|KB) \(1500×2000\)/)).toBeVisible();

  // Reorder (second becomes main) and describe both photos.
  await page.getByRole('button', { name: 'Move photo 2 earlier' }).click();
  await page.getByLabel('Alt text for photo 1').fill('Side view of the pendant');
  await page.getByLabel('Alt text for photo 2').fill('Front view of the pendant');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible();

  // Saved order, alt text and the uploaded files themselves.
  const saved = await (await request.get(`${API}/admin/products/${product.id}`, { headers: auth(token) })).json();
  const images = [...saved.images].sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder);
  expect(images.map((i: { alt: string }) => i.alt)).toEqual(['Side view of the pendant', 'Front view of the pendant']);
  for (const img of images) {
    const file = await request.get(img.url);
    expect(file.ok()).toBe(true);
    expect(file.headers()['content-type']).toBe('image/webp');
    const body = await file.body();
    expect(body.length).toBeLessThan(photos[0].length);
  }

  // The storefront shows the new main photo with its alt text.
  await page.goto(`${STORE}/product/${product.slug}`);
  await expect(page.getByRole('img', { name: 'Side view of the pendant' }).first()).toBeVisible();
});
