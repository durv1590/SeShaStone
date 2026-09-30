/** Masks all but the last 4 characters, e.g. 12345678901 → •••••••8901. */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return '';
  const v = String(value);
  return v.length <= visible ? v : '•'.repeat(v.length - visible) + v.slice(-visible);
}
