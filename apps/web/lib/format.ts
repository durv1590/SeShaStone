const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Formats an amount in paise as Indian Rupees, e.g. 4850000 → ₹48,500. */
export function formatPrice(paise: number): string {
  return inr.format(paise / 100);
}
