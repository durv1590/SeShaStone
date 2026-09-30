const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

/** Formats integer paise as rupees. All money in the system is integer paise — never floats. */
export function formatInr(paise: number): string {
  return inr.format(paise / 100);
}

/** Converts a rupee string such as "48,500.50" to integer paise without floating-point error. */
export function rupeesToPaise(value: string): number {
  const clean = value.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error(`Invalid rupee amount: ${value}`);
  const [whole, frac = ''] = clean.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
