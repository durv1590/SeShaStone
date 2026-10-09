import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Automated WCAG 2.1 A/AA checks with axe-core (manual review is still required). */
const PAGES = ['/', '/gold', '/collections/new-arrivals', '/login', '/register', '/order-tracking', '/pages/about', '/cart'];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}

test('keyboard users can reach the main navigation and open a mega menu', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  // Real keyboard navigation (programmatic focus does not trigger :focus-visible).
  await page.getByRole('link', { name: 'SeSha Stone — home' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Gold', exact: true })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Shop all Gold' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Shop all Gold' })).toBeFocused();
});
