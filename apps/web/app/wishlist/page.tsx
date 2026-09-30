'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AccountShell } from '@/components/account-shell';
import { BrandMark } from '@/components/brand';
import { WishlistButton } from '@/components/wishlist-button';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

interface Item {
  productId: string;
  product: { id: string; name: string; slug: string; status: string; images: { url: string; alt: string | null }[]; variants: { price: number }[] };
}

export default function WishlistPage() {
  const { token, wishlist } = useStore();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Item[]>('/me/wishlist', { token }).then(setItems).catch(() => setItems([]));
  }, [token]);

  const visible = items?.filter((i) => wishlist.has(i.productId) && i.product.status === 'ACTIVE') ?? [];

  return (
    <AccountShell title="Wishlist">
      {items && !visible.length && (
        <div className="empty">
          <p>Save pieces you love with the heart icon.</p>
          <Link href="/collections" className="link">Explore collections</Link>
        </div>
      )}
      <div className="grid grid--3">
        {visible.map(({ product: p }) => (
          <article key={p.id} className="card">
            <Link href={`/product/${p.slug}`} className="card__media" aria-label={p.name}>
              {p.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.images[0].url} alt={p.images[0].alt ?? p.name} loading="lazy" />
              ) : <BrandMark size={56} />}
            </Link>
            <WishlistButton productId={p.id} name={p.name} className="card__wish" />
            <div className="card__body">
              <h3 className="card__title"><Link href={`/product/${p.slug}`}>{p.name}</Link></h3>
              {p.variants[0] && <p className="price" style={{ margin: 0 }}>{formatPrice(p.variants[0].price)}</p>}
            </div>
          </article>
        ))}
      </div>
    </AccountShell>
  );
}
