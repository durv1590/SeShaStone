import Link from 'next/link';
import type { StoreSettings } from '@/lib/api';
import { LINES } from '@/lib/lines';
import { BrandLogo, Icon } from './brand';

const href = (v: string) => (/^https?:\/\//.test(v) ? v : `https://${v}`);

/** Contact details load from Admin → Settings. Bank / UPI details are never shown here. */
export function SiteFooter({ settings }: { settings: StoreSettings }) {
  const s = settings;
  const social = [
    ['Instagram', s['store.instagram']],
    ['Facebook', s['store.facebook']],
    ['YouTube', s['store.youtube']],
  ].filter(([, url]) => url);
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__brand">
          <BrandLogo variant="champagne" legal size={44} />
          <p className="footer__tagline">Timeless Elegance</p>
          <p>A modern Indian jewellery house where timeless craftsmanship meets contemporary luxury.</p>
        </div>
        <div>
          <h2>Shop</h2>
          <ul>{LINES.map((l) => <li key={l.key}><Link href={l.path}>{l.label}</Link></li>)}</ul>
        </div>
        <div>
          <h2>Collections</h2>
          <ul>
            <li><Link href="/collections/new-arrivals">New Arrivals</Link></li>
            <li><Link href="/collections/bestsellers">Bestsellers</Link></li>
            <li><Link href="/collections/bridal">Bridal</Link></li>
            <li><Link href="/collections/wedding">Wedding</Link></li>
            <li><Link href="/collections/festive">Festive</Link></li>
            <li><Link href="/collections/limited">Limited Collection</Link></li>
          </ul>
        </div>
        <div>
          <h2>Customer Care</h2>
          <ul>
            <li><Link href="/pages/contact">Contact Us</Link></li>
            <li><Link href="/order-tracking">Track Order</Link></li>
            <li><Link href="/pages/shipping-policy">Shipping</Link></li>
            <li><Link href="/pages/return-policy">Returns</Link></li>
            <li><Link href="/pages/faqs">FAQs</Link></li>
            <li><Link href="/pages/jewellery-care">Jewellery Care</Link></li>
          </ul>
        </div>
        <div>
          <h2>Company</h2>
          <ul>
            <li><Link href="/pages/about">About SeSha Stone</Link></li>
            <li><Link href="/pages/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/pages/terms-and-conditions">Terms &amp; Conditions</Link></li>
            <li><Link href="/pages/refund-policy">Refund Policy</Link></li>
            <li><Link href="/pages/payment-policy">Payment Policy</Link></li>
          </ul>
          <h2 style={{ marginTop: 24 }}>Connect</h2>
          <div className="footer__contact" style={{ display: 'grid', gap: 9 }}>
            {s['store.supportPhone'] && <a href={`tel:${s['store.supportPhone'].replace(/[^\d+]/g, '')}`}><Icon name="phone" size={15} /> {s['store.supportPhone']}</a>}
            {s['store.whatsapp'] && (
              <a href={`https://wa.me/${s['store.whatsapp'].replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={15} /> WhatsApp
              </a>
            )}
            {s['store.supportEmail'] && <a href={`mailto:${s['store.supportEmail']}`}><Icon name="mail" size={15} /> {s['store.supportEmail']}</a>}
            {social.map(([label, url]) => (
              <a key={label} href={href(url)} target="_blank" rel="noopener noreferrer">{label}</a>
            ))}
          </div>
        </div>
      </div>
      <div className="container footer__legal">
        <span>© {new Date().getFullYear()} {s['store.legalName']}</span>
        {s['store.website'] && <a href={href(s['store.website'])}>{s['store.website'].replace(/^https?:\/\//, '')}</a>}
      </div>
    </footer>
  );
}
