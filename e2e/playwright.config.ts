import { defineConfig } from '@playwright/test';

/**
 * End-to-end + API integration suite. Runs against a running stack:
 *   API   http://localhost:4000  (npm run dev:api)
 *   Store http://localhost:3000  (npm run dev:web)
 *   Admin http://localhost:3001  (npm run dev:admin)
 * Override with E2E_API_URL / E2E_STORE_URL / E2E_ADMIN_URL. Set CHROMIUM_PATH to use a
 * preinstalled Chromium. Uses the seeded Super Admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_STORE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
});
