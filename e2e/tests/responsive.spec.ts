import { expect, test } from '@playwright/test';

/** Master brief §33: no horizontal overflow at any required width. */
const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const PAGES = ['/', '/gold', '/gold/rings', '/premium-artificial', '/collections', '/collections/bridal', '/search?q=ring', '/cart', '/login', '/order-tracking', '/pages/faqs'];

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px`, async ({ page, request }) => {
    const productSlug = await request
      .get(`${process.env.E2E_API_URL ?? 'http://localhost:4000'}/api/v1/products?pageSize=1`)
      .then((r) => r.json())
      .then((r) => r.items[0]?.slug as string | undefined);
    await page.setViewportSize({ width, height: 900 });
    for (const path of [...PAGES, ...(productSlug ? [`/product/${productSlug}`] : [])]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}
