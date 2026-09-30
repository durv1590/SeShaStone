/** Shop-by-collection entry points from the brand board. */
export const COLLECTIONS = [
  { key: 'gold', label: 'Gold Jewellery', short: 'Gold', href: '/products?metal=GOLD' },
  { key: 'silver', label: 'Silver Jewellery', short: 'Silver', href: '/products?metal=SILVER' },
  { key: 'diamond', label: 'Diamond Jewellery', short: 'Diamond', href: '/products?gemstone=Diamond' },
  {
    key: 'artificial',
    label: 'Premium Artificial Jewellery',
    short: 'Premium Artificial',
    href: '/products?category=premium-artificial-jewellery',
  },
] as const;

export type CollectionKey = (typeof COLLECTIONS)[number]['key'];

/** Page title for a product listing, based on the active filters. */
export function listingTitle(params: Record<string, string | undefined>): string {
  if (params.metal === 'GOLD') return 'Gold Jewellery';
  if (params.metal === 'SILVER') return 'Silver Jewellery';
  if (params.gemstone?.toLowerCase() === 'diamond') return 'Diamond Jewellery';
  if (params.category) {
    return params.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (params.q) return `Results for “${params.q}”`;
  return 'All Jewellery';
}
