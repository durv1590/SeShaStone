'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

const LINKS = [
  ['/account', 'Profile & addresses'],
  ['/account/orders', 'Orders'],
  ['/wishlist', 'Wishlist'],
];

/** Signed-in area wrapper: redirects to login and renders the account navigation. */
export function AccountShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { hydrated, token, user, logout } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !token) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, token, router, pathname]);

  if (!hydrated || !token) return <div className="container section" aria-busy="true" />;

  return (
    <div className="container section" style={{ paddingTop: 32 }}>
      <p className="eyebrow">Hello, {user?.firstName}</p>
      <h1 style={{ marginBottom: 28 }}>{title}</h1>
      <div className="account">
        <nav className="account-nav" aria-label="Account">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>
          ))}
          <button type="button" className="link muted" style={{ background: 'none', border: 0, textAlign: 'left', padding: '10px 14px', cursor: 'pointer' }} onClick={() => { logout(); router.push('/'); }}>
            Sign out
          </button>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
