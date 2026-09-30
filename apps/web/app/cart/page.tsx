'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/brand';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

interface Quote { subtotal: number; discount: number; shipping: number; tax: number; total: number }

export default function CartPage() {
  const { cart, updateQuantity, token, hydrated } = useStore();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const localSubtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  // Signed-in shoppers get a server-validated quote (live prices + stock). Prices in the bag are indicative.
  useEffect(() => {
    if (!token || !cart.length) return setQuote(null);
    api<Quote>('/checkout/quote', {
      method: 'POST',
      token,
      body: JSON.stringify({ items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
    })
      .then((q) => { setQuote(q); setQuoteError(null); })
      .catch((e) => setQuoteError(e.message));
  }, [token, cart]);

  if (!hydrated) return <div className="container section" aria-busy="true" />;

  if (!cart.length) {
    return (
      <div className="container section" style={{ textAlign: 'center' }}>
        <h1>Your bag is empty</h1>
        <p className="muted" style={{ margin: '12px 0 24px' }}>Discover pieces designed for life’s most beautiful moments.</p>
        <Link href="/collections/new-arrivals" className="btn">Shop New Arrivals</Link>
      </div>
    );
  }

  return (
    <div className="container section">
      <h1 style={{ marginBottom: 24 }}>Your Bag</h1>
      <div className="two-col">
        <div>
          {cart.map((l) => (
            <div key={l.variantId} className="cart-line">
              <Link href={`/product/${l.slug}`} className="cart-line__img" aria-label={l.productName}>
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" />
                ) : (
                  <BrandMark size={36} />
                )}
              </Link>
              <div>
                <Link href={`/product/${l.slug}`} className="card__title" style={{ display: 'block' }}>{l.productName}</Link>
                <p className="muted" style={{ margin: '2px 0 8px', fontSize: '0.82rem' }}>{l.variantTitle}</p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div className="qty" role="group" aria-label={`Quantity of ${l.productName}`}>
                    <button type="button" aria-label="Decrease" onClick={() => updateQuantity(l.variantId, l.quantity - 1)}>−</button>
                    <span>{l.quantity}</span>
                    <button type="button" aria-label="Increase" onClick={() => updateQuantity(l.variantId, l.quantity + 1)}>+</button>
                  </div>
                  <button type="button" className="link muted" style={{ background: 'none', border: 0, cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => updateQuantity(l.variantId, 0)}>
                    Remove
                  </button>
                </div>
              </div>
              <p className="price" style={{ margin: 0 }}>{formatPrice(l.price * l.quantity)}</p>
            </div>
          ))}
        </div>
        <aside className="summary" aria-label="Order summary">
          <h2 style={{ fontSize: '1.5rem' }}>Summary</h2>
          {quote ? (
            <>
              <div className="summary-row"><span>Subtotal</span><span>{formatPrice(quote.subtotal)}</span></div>
              <div className="summary-row"><span>Delivery</span><span>{quote.shipping ? formatPrice(quote.shipping) : 'Free'}</span></div>
              <div className="summary-row summary-row--total"><span>Total</span><span>{formatPrice(quote.total)}</span></div>
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>Includes GST of {formatPrice(quote.tax)}</p>
            </>
          ) : (
            <>
              <div className="summary-row"><span>Subtotal</span><span>{formatPrice(localSubtotal)}</span></div>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Delivery, offers and final prices are confirmed at checkout.</p>
            </>
          )}
          {quoteError && <p className="error" role="alert">{quoteError}</p>}
          <Link href="/checkout" className="btn btn--block">Proceed to Checkout</Link>
          <Link href="/collections" className="link muted" style={{ textAlign: 'center', fontSize: '0.85rem' }}>Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
