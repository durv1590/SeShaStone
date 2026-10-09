'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useRef } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from './brand';

const SUGGESTIONS = ['Diamond Rings', 'Gold Earrings', 'Bridal Jewellery', 'Silver Anklets', 'Artificial Necklace'];

export function HeaderActions() {
  const { user, cart, wishlist, hydrated } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const count = cart.reduce((n, l) => n + l.quantity, 0);

  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
    dialog.current?.close();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  }

  return (
    <div className="header__actions">
      <button type="button" className="icon-btn" aria-label="Search" onClick={() => dialog.current?.showModal()}>
        <Icon name="search" />
      </button>
      <Link href={user ? '/account' : '/login'} className="icon-btn hide-mobile" aria-label={user ? `Account — ${user.firstName}` : 'Sign in'}>
        <Icon name="user" />
      </Link>
      <Link href="/wishlist" className="icon-btn" aria-label={`Wishlist${wishlist.size ? `, ${wishlist.size} items` : ''}`}>
        <Icon name="heart" />
        {hydrated && wishlist.size > 0 && <span className="badge-count" aria-hidden="true">{wishlist.size}</span>}
      </Link>
      <Link href="/cart" className="icon-btn" aria-label={`Bag${count ? `, ${count} items` : ''}`}>
        <Icon name="bag" />
        {hydrated && count > 0 && <span className="badge-count" aria-hidden="true">{count}</span>}
      </Link>

      <dialog ref={dialog} className="search-dialog" aria-label="Search jewellery" onClick={(e) => e.target === dialog.current && dialog.current.close()}>
        <form onSubmit={search} role="search">
          <label htmlFor="site-search" className="sr-only">Search jewellery</label>
          <input id="site-search" name="q" className="input" placeholder="Search rings, diamonds, bridal…" autoFocus />
          <button className="btn">Search</button>
        </form>
        <div className="search-dialog__hints">
          {SUGGESTIONS.map((s) => (
            <Link key={s} className="chip" href={`/search?q=${encodeURIComponent(s)}`} onClick={() => dialog.current?.close()}>{s}</Link>
          ))}
        </div>
      </dialog>
    </div>
  );
}
