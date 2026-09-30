'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Address, api, Order } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { payForOrder } from '@/lib/payments';
import { useStore } from '@/lib/store';

interface Quote {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  UPI: 'UPI (GPay, PhonePe, Paytm)',
  RAZORPAY: 'Cards, Netbanking & Wallets',
  CASHFREE: 'Cashfree',
  COD: 'Cash on delivery',
};

export default function CheckoutPage() {
  const { token, cart, clearCart } = useStore();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>();
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>();
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>();
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const items = cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity }));

  useEffect(() => {
    if (token === null && typeof window !== 'undefined' && !localStorage.getItem('sss.token')) {
      router.replace('/login?next=/checkout');
    }
  }, [token, router]);

  useEffect(() => {
    if (!token) return;
    api<Address[]>('/me/addresses', { token }).then((list) => {
      setAddresses(list);
      setAddressId((current) => current ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id);
    });
    api<Record<string, unknown>>('/settings').then((s) => {
      const list = [...((s['payments.enabledProviders'] as string[]) ?? [])];
      if (s['checkout.codEnabled']) list.push('COD');
      setProviders(list);
      setProvider((current) => current ?? list[0]);
    });
  }, [token]);

  const refreshQuote = useCallback(
    async (couponCode?: string) => {
      if (!token || !items.length) return;
      try {
        const q = await api<Quote>('/checkout/quote', {
          method: 'POST',
          token,
          body: JSON.stringify({ items, couponCode: couponCode || undefined }),
        });
        setQuote(q);
        setAppliedCoupon(q.couponCode ?? undefined);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token, JSON.stringify(items)],
  );

  useEffect(() => {
    void refreshQuote(appliedCoupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshQuote]);

  async function addAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const created = await api<Address>('/me/addresses', { method: 'POST', token, body: JSON.stringify(body) });
      setAddresses((prev) => [created, ...prev]);
      setAddressId(created.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function placeOrder() {
    if (!token || !addressId || !provider) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api<Order>('/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ items, addressId, paymentProvider: provider, couponCode: appliedCoupon }),
      });
      if (provider !== 'COD') await payForOrder(order.id, token, provider);
      clearCart();
      router.push(`/account/orders?placed=${order.orderNumber}`);
    } catch (err) {
      setError(`${(err as Error).message}. You can retry payment from your orders page.`);
    } finally {
      setBusy(false);
    }
  }

  if (!cart.length) {
    return (
      <div className="container section">
        <h1 className="section-title">Nothing to check out</h1>
        <Link className="btn" href="/products">Shop now</Link>
      </div>
    );
  }

  return (
    <div className="container section two-col">
      <div style={{ display: 'grid', gap: 32 }}>
        <section>
          <h2>Delivery address</h2>
          {addresses.map((a) => (
            <label key={a.id} className="summary" style={{ marginBottom: 10, cursor: 'pointer' }}>
              <span>
                <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />{' '}
                <strong>{a.fullName}</strong> · {a.phone}
              </span>
              <span className="muted">{a.line1}, {a.city}, {a.state} {a.pincode}</span>
            </label>
          ))}
          <details open={!addresses.length}>
            <summary className="muted" style={{ cursor: 'pointer', margin: '12px 0' }}>Add a new address</summary>
            <form className="form" onSubmit={addAddress}>
              <input className="input" name="fullName" placeholder="Full name" required />
              <input className="input" name="phone" placeholder="Mobile (+91…)" required />
              <input className="input" name="line1" placeholder="House no., street" required />
              <input className="input" name="line2" placeholder="Area (optional)" />
              <input className="input" name="city" placeholder="City" required />
              <input className="input" name="state" placeholder="State" required />
              <input className="input" name="pincode" placeholder="PIN code" pattern="[1-9][0-9]{5}" required />
              <button className="btn btn-outline">Save address</button>
            </form>
          </details>
        </section>

        <section>
          <h2>Payment</h2>
          {providers.map((p) => (
            <label key={p} style={{ display: 'block', margin: '8px 0' }}>
              <input type="radio" name="provider" checked={provider === p} onChange={() => setProvider(p)} />{' '}
              {PROVIDER_LABELS[p] ?? p}
            </label>
          ))}
        </section>
      </div>

      <aside className="summary">
        <h3 style={{ margin: 0 }}>Order summary</h3>
        {quote && (
          <>
            <div className="summary-row"><span>Subtotal</span><span>{formatPrice(quote.subtotal)}</span></div>
            {quote.discount > 0 && (
              <div className="summary-row"><span>Discount ({quote.couponCode})</span><span>−{formatPrice(quote.discount)}</span></div>
            )}
            <div className="summary-row"><span>Shipping</span><span>{quote.shipping ? formatPrice(quote.shipping) : 'Free'}</span></div>
            <div className="summary-row"><strong>Total</strong><strong>{formatPrice(quote.total)}</strong></div>
            <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Includes GST of {formatPrice(quote.tax)}</p>
          </>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
          <button className="btn btn-outline" type="button" onClick={() => refreshQuote(coupon)}>Apply</button>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-block" disabled={busy || !addressId || !provider || !quote} onClick={placeOrder}>
          {busy ? 'Processing…' : 'Place order'}
        </button>
      </aside>
    </div>
  );
}
