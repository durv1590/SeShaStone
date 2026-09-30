import type { MetadataRoute } from 'next';
import { api, Collection, Paginated, ProductSummary } from '@/lib/api';
import { LINES } from '@/lib/lines';
import { absolute } from '@/lib/seo';

const POLICY_PAGES = ['about', 'contact', 'jewellery-care', 'faqs', 'shipping-policy', 'return-policy', 'refund-policy', 'payment-policy', 'privacy-policy', 'terms-and-conditions', 'cancellation-policy'];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, products] = await Promise.all([
    api<Collection[]>('/collections').catch(() => [] as Collection[]),
    api<Paginated<ProductSummary>>('/products?pageSize=100').then((r) => r.items).catch(() => [] as ProductSummary[]),
  ]);
  const now = new Date();
  return [
    { url: absolute('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    ...LINES.flatMap((l) => [
      { url: absolute(l.path), lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
      ...l.subcategories.map((s) => ({ url: absolute(`${l.path}/${s.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ]),
    { url: absolute('/collections'), lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...collections.map((c) => ({ url: absolute(`/collections/${c.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: absolute(`/product/${p.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...POLICY_PAGES.map((slug) => ({ url: absolute(`/pages/${slug}`), lastModified: now, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
