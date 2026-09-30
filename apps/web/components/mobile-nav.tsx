'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LINES } from '@/lib/lines';
import { useStore } from '@/lib/store';
import { BrandLogo, Icon } from './brand';

export function MobileNav({ settings }: { settings: { phone: string; whatsapp: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useStore();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button type="button" className="icon-btn header__menu-btn" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {open && (
        <>
          <button type="button" className="drawer-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer__head">
              <BrandLogo variant="champagne" size={30} />
              <button ref={closeRef} type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <nav aria-label="Mobile">
              {LINES.map((line) => (
                <details key={line.key}>
                  <summary>{line.label} <Icon name="chevron" size={16} /></summary>
                  <div className="drawer__sub">
                    <Link href={line.path}>Shop all</Link>
                    {line.subcategories.map((s) => <Link key={s.slug} href={`${line.path}/${s.slug}`}>{s.label}</Link>)}
                  </div>
                </details>
              ))}
              <Link className="drawer__link" href="/collections">Collections</Link>
              <Link className="drawer__link" href="/collections/bridal">Bridal</Link>
              <Link className="drawer__link" href="/collections/new-arrivals">New Arrivals</Link>
              <Link className="drawer__link" href={user ? '/account' : '/login'}>{user ? 'My Account' : 'Sign In'}</Link>
            </nav>
            <div className="drawer__foot">
              <Link href="/order-tracking"><Icon name="truck" size={16} /> Track Order</Link>
              <Link href="/pages/contact"><Icon name="mail" size={16} /> Contact</Link>
              {settings.phone && <a href={`tel:${settings.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={16} /> {settings.phone}</a>}
              {settings.whatsapp && (
                <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" size={16} /> WhatsApp
                </a>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
