import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo, TrustBar } from '@/components/brand';
import { HeaderActions } from '@/components/header-actions';
import { api, Category, StoreSettings } from '@/lib/api';
import { COLLECTIONS } from '@/lib/collections';
import { fontVariables } from '@/lib/fonts';
import { StoreProvider } from '@/lib/store';
import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'SeSha Stone — Premium Jewellery for Every Celebration',
    template: '%s · SeSha Stone',
  },
  description:
    'Where every stone tells a story. Gold, silver, diamond and premium artificial jewellery from SeSha Stone Pvt. Ltd.',
};

const COLLECTION_CATEGORY = 'premium-artificial-jewellery';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [categories, settings] = await Promise.all([
    api<Category[]>('/categories').catch(() => []),
    api<StoreSettings>('/settings').catch(() => ({}) as StoreSettings),
  ]);
  const phone = settings['store.supportPhone'];
  const email = settings['store.supportEmail'];
  const website = settings['store.website'];

  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        <StoreProvider>
          <header className="header">
            <div className="container header-inner">
              <Link href="/" aria-label="SeSha Stone home">
                <Logo />
              </Link>
              <nav className="nav">
                <Link href="/products">Shop all</Link>
                {COLLECTIONS.map((c) => (
                  <Link key={c.key} href={c.href}>{c.short}</Link>
                ))}
                {categories
                  .filter((c) => c.slug !== COLLECTION_CATEGORY)
                  .map((c) => (
                    <Link key={c.id} href={`/products?category=${c.slug}`}>{c.name}</Link>
                  ))}
              </nav>
              <HeaderActions />
            </div>
          </header>
          <main>{children}</main>
          <TrustBar />
          <footer className="footer">
            <div className="container footer-inner">
              <div className="footer-brand">
                <Logo legal size={44} />
                <p className="tagline">Timeless Elegance</p>
              </div>
              <div>
                <h3 className="footer-heading">Shop</h3>
                <ul className="footer-list">
                  {COLLECTIONS.map((c) => (
                    <li key={c.key}><Link href={c.href}>{c.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="footer-heading">Help</h3>
                <ul className="footer-list">
                  <li><Link href="/pages/about">About us</Link></li>
                  <li><Link href="/pages/shipping-policy">Shipping</Link></li>
                  <li><Link href="/pages/returns">Returns</Link></li>
                  <li><Link href="/pages/contact">Contact</Link></li>
                </ul>
              </div>
              {(email || phone || website) && (
                <div>
                  <h3 className="footer-heading">Contact</h3>
                  <ul className="footer-list">
                    {phone && <li><a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a></li>}
                    {email && <li><a href={`mailto:${email}`}>{email}</a></li>}
                    {website && <li><a href={`https://${website.replace(/^https?:\/\//, '')}`}>{website}</a></li>}
                  </ul>
                </div>
              )}
            </div>
            <div className="container footer-legal">
              © {new Date().getFullYear()} {settings['store.legalName'] ?? 'SeSha Stone Pvt. Ltd.'} · BIS hallmarked · Certified gemstones
            </div>
          </footer>
        </StoreProvider>
      </body>
    </html>
  );
}
