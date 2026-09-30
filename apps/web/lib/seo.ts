import type { Metadata } from 'next';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.seshastone.com').replace(/\/$/, '');
export const SITE_NAME = 'SeSha Stone';
export const DEFAULT_DESCRIPTION =
  'SeSha Stone — a modern Indian jewellery house. Gold, silver, diamond and premium artificial jewellery designed for life’s most beautiful moments.';

export const absolute = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Page metadata with canonical URL and Open Graph / Twitter cards. */
export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  noindex = false,
}: {
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  noindex?: boolean;
}): Metadata {
  const images = [{ url: image ?? absolute('/brand/social/profile-icon.png') }];
  return {
    title,
    description,
    alternates: { canonical: absolute(path) },
    openGraph: { title, description, url: absolute(path), siteName: SITE_NAME, images, locale: 'en_IN', type: 'website' },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: images.map((i) => i.url) },
    ...(noindex && { robots: { index: false, follow: false } }),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absolute(item.path) })),
  };
}
