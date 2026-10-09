'use client';

import { ApiError } from '@/lib/api';

/**
 * Runs a request that the API may reject with 409 "confirmation required" (financial settings,
 * QR uploads). Shows the server's message, and retries with confirmation if the user agrees.
 */
export async function withConfirmation<T>(run: (confirm: boolean) => Promise<T>): Promise<T | null> {
  try {
    return await run(false);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409 && err.body?.confirmationRequired) {
      if (!window.confirm(`${err.message}\n\nContinue?`)) return null;
      return run(true);
    }
    throw err;
  }
}
