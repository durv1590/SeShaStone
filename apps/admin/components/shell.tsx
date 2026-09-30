'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, setToken } from '@/lib/api';

const NAV = [
  ['/', 'Dashboard'],
  ['/orders', 'Orders'],
  ['/products', 'Products'],
  ['/categories', 'Categories'],
  ['/inventory', 'Inventory'],
  ['/customers', 'Customers'],
  ['/coupons', 'Coupons'],
  ['/reviews', 'Reviews'],
  ['/cms', 'CMS'],
  ['/marketing', 'Marketing'],
  ['/payments', 'Payments'],
  ['/settings', 'Settings'],
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">SE SHA STONE</div>
        {NAV.map(([href, label]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
        <div className="spacer" />
        <a
          href="/login"
          onClick={() => {
            setToken(null);
          }}
        >
          Sign out
        </a>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
