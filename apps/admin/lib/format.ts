const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Formats integer paise as rupees, e.g. 4850000 → ₹48,500 and 4850050 → ₹48,500.5. */
export function formatPrice(paise: number): string {
  return inr.format(paise / 100);
}

/** Parses a rupee amount typed by staff into integer paise (no floating-point drift). */
export function rupeesToPaise(value: string): number {
  const clean = value.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
