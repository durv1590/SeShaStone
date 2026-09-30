import Link from 'next/link';
import type { StoreSettings } from '@/lib/api';
import { LINES } from '@/lib/lines';
import { BrandLogo, Icon } from './brand';
import { HeaderActions } from './header-actions';
import { MobileNav } from './mobile-nav';

export const MAIN_NAV = [
  ...LINES.map((l) => ({ label: l.short, href: l.path, line: l })),
  { label: 'Collections', href: '/collections', line: undefined },
  { label: 'Bridal', href: '/collections/bridal', line: undefined },
  { label: 'New Arrivals', href: '/collections/new-arrivals', line: undefined },
];

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
const wa = (n: string) => `https://wa.me/${n.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`;

export function SiteHeader({ settings }: { settings: StoreSettings }) {
  const phone = settings['store.supportPhone'];
  const whatsapp = settings['store.whatsapp'];
  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {settings['store.announcement'] && <div className="announcement">{settings['store.announcement']}</div>}
      <div className="utility">
        <div className="container utility__inner">
          {phone && <a href={tel(phone)}><Icon name="phone" size={14} /> Customer Support {phone}</a>}
          <Link href="/order-tracking"><Icon name="truck" size={14} /> Track Order</Link>
          <Link href="/pages/contact"><Icon name="mail" size={14} /> Contact</Link>
          {whatsapp && <a href={wa(whatsapp)} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={14} /> WhatsApp</a>}
        </div>
      </div>
      <header className="header">
        <div className="container header__inner">
          <MobileNav settings={{ phone, whatsapp }} />
          <Link href="/" className="header__logo" aria-label="SeSha Stone — home">
            <BrandLogo variant="champagne" size={36} />
          </Link>
          <nav className="nav" aria-label="Main">
            {MAIN_NAV.map((item) => (
              <div className="nav__item" key={item.href}>
                <Link href={item.href} className="nav__link">{item.label}</Link>
                {item.line && (
                  <div className="mega">
                    <div className="container mega__inner">
                      <div className="mega__intro">
                        <p className="eyebrow">SeSha Stone</p>
                        <h3>{item.line.label}</h3>
                        <p>{item.line.intro}</p>
                        <Link href={item.line.path} className="more-link">Shop all {item.line.short}</Link>
                      </div>
                      <div className="mega__links">
                        {item.line.subcategories.map((s) => (
                          <Link key={s.slug} href={`${item.line!.path}/${s.slug}`}>{s.label}</Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <HeaderActions />
        </div>
      </header>
    </>
  );
}
