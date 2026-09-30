'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';

export function HeaderActions() {
  const { user, cart, logout } = useStore();
  const count = cart.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="header-actions">
      {user ? (
        <>
          <Link href="/account/orders">Hi, {user.firstName}</Link>
          <button className="chip" onClick={logout}>Logout</button>
        </>
      ) : (
        <Link href="/login">Login</Link>
      )}
      <Link href="/cart">Bag ({count})</Link>
    </div>
  );
}
