import type { Metadata, Viewport } from 'next';
import { JsonLd } from '@/components/json-ld';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TrustBar } from '@/components/brand';
import { getSettings } from '@/lib/api';
import { fontVariables } from '@/lib/fonts';
import { absolute, DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'SeSha Stone — Timeless Elegance | Premium Jewellery', template: '%s · SeSha Stone' },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: 'en_IN', type: 'website', images: [absolute('/brand/social/profile-icon.png')] },
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/brand/favicon/favicon-32.png', sizes: '32x32' }] },
};

export const viewport: Viewport = { themeColor: '#181818', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const sameAs = [settings['store.instagram'], settings['store.facebook'], settings['store.youtube']]
    .filter(Boolean)
    .map((u) => (/^https?:\/\//.test(u) ? u : `https://${u}`));

  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        <StoreProvider>
          <SiteHeader settings={settings} />
          <main id="main">{children}</main>
          <TrustBar points={settings['store.trustPoints']} />
          <SiteFooter settings={settings} />
        </StoreProvider>
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: settings['store.legalName'],
              alternateName: SITE_NAME,
              url: SITE_URL,
              logo: absolute('/brand/favicon/favicon-512.png'),
              ...(settings['store.supportEmail'] && { email: settings['store.supportEmail'] }),
              ...(settings['store.supportPhone'] && {
                contactPoint: { '@type': 'ContactPoint', telephone: settings['store.supportPhone'], contactType: 'customer service', areaServed: 'IN' },
              }),
              ...(sameAs.length && { sameAs }),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: SITE_NAME,
              url: SITE_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
                'query-input': 'required name=search_term_string',
              },
            },
          ]}
        />
      </body>
    </html>
  );
}
