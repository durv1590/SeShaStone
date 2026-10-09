import type { MetadataRoute } from 'next';
import { absolute } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/account', '/wishlist', '/login', '/register', '/forgot-password', '/reset-password', '/search'] }],
    sitemap: absolute('/sitemap.xml'),
  };
}
