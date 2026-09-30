import type { Metadata } from 'next';
import Link from 'next/link';
import { HeaderActions } from '@/components/header-actions';
import { api, Category, StoreSettings } from '@/lib/api';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Se Sha Stone — Fine Jewellery', template: '%s · Se Sha Stone' },
  description: 'Handcrafted fine jewellery with certified gemstones.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([
    api<Category[]>('/categories').catch(() => []),
    api<StoreSettings>('/settings').catch(() => ({}) as StoreSettings),
  ]);
  const phone = settings['store.supportPhone'];
  const email = settings['store.supportEmail'];
  const website = settings['store.website'];

  return (
    <html lang="en-IN">
      <body>
        <StoreProvider>
          <header className="header">
            <div className="container header-inner">
              <Link href="/" className="logo">SE SHA STONE</Link>
              <nav className="nav">
                <Link href="/products">Shop all</Link>
                {categories.map((c) => (
                  <Link key={c.id} href={`/products?category=${c.slug}`}>{c.name}</Link>
                ))}
              </nav>
              <HeaderActions />
            </div>
          </header>
          <main>{children}</main>
          <footer className="footer">
            <div className="container">
              <div className="footer-links">
                <Link href="/pages/about">About</Link>
                <Link href="/pages/shipping-policy">Shipping</Link>
                <Link href="/pages/returns">Returns</Link>
                <Link href="/pages/contact">Contact</Link>
              </div>
              {(email || phone) && (
                <p className="footer-contact">
                  {email && <a href={`mailto:${email}`}>{email}</a>}
                  {phone && <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>}
                  {website && <a href={`https://${website.replace(/^https?:\/\//, '')}`}>{website}</a>}
                </p>
              )}
              <p>
                © {new Date().getFullYear()} {settings['store.legalName'] ?? 'Se Sha Stone'} · BIS hallmarked · Certified gemstones
              </p>
            </div>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
