import { randomInt } from 'node:crypto';

/** Human-friendly order number, e.g. SSS-250930-4821. */
export function generateOrderNumber(now = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `SSS-${yy}${mm}${dd}-${randomInt(1000, 10000)}${randomInt(10, 100)}`;
}
