'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getToken, setToken } from '@/lib/api';
import { SessionProvider, useSession } from './session';

/** Navigation filtered by the signed-in role's permissions. */
const NAV: [href: string, label: string, permission: string][] = [
  ['/', 'Dashboard', 'dashboard.view'],
  ['/orders', 'Orders', 'orders.view'],
  ['/payments', 'Payments', 'payments.view'],
  ['/refunds', 'Refunds', 'refunds.manage'],
  ['/products', 'Products', 'products.view'],
  ['/categories', 'Categories', 'products.view'],
  ['/collections', 'Collections', 'products.view'],
  ['/inventory', 'Inventory', 'inventory.manage'],
  ['/customers', 'Customers', 'customers.view'],
  ['/reviews', 'Reviews', 'reviews.moderate'],
  ['/coupons', 'Coupons', 'marketing.manage'],
  ['/cms', 'Banners & CMS', 'content.manage'],
  ['/marketing', 'Marketing', 'marketing.manage'],
  ['/settings', 'Settings', 'settings.view'],
  ['/users', 'Staff & roles', 'users.manage'],
  ['/audit-logs', 'Audit log', 'audit.view'],
];

function Nav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, can } = useSession();
  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Admin navigation">
        <div className="brand">SeSha Stone<small>ADMIN</small></div>
        {NAV.filter(([, , p]) => can(p)).map(([href, label]) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
              {label}
            </Link>
          );
        })}
        <div className="spacer" />
        {me && <div className="whoami">{me.firstName}<small>{me.role.replace(/_/g, ' ').toLowerCase()}</small></div>}
        <a href="/login" onClick={() => setToken(null)}>Sign out</a>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return (
    <SessionProvider>
      <Nav>{children}</Nav>
    </SessionProvider>
  );
}
