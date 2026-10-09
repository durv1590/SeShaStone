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
      const { overflow, culprits } = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        // On failure, name the elements that stick out so the cause is visible in CI logs.
        const sticking = overflow > 0 ? [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5) : [];
        // Innermost offenders only: skip wrappers that merely contain one.
        const culprits =
          overflow > 0
            ? sticking
                .filter((el) => !sticking.some((other) => other !== el && el.contains(other)))
                .slice(0, 5)
                .map((el) => {
                  const r = el.getBoundingClientRect();
                  const name = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''}`;
                  return `${name} [${Math.round(r.left)}–${Math.round(r.right)}] font=${getComputedStyle(el).fontFamily.split(',')[0]} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
                })
                .concat(`fonts loaded: ${[...document.fonts].filter((f) => f.status === 'loaded').length}/${document.fonts.size}`)
            : [];
        return { overflow, culprits };
      });
      expect(overflow, `${path} overflows by ${overflow}px at ${width}px\n  ${culprits.join('\n  ')}`).toBeLessThanOrEqual(0);
    }
  });
}
