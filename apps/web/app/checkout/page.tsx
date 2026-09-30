'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Address, api, Order } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { payForOrder } from '@/lib/payments';
import { useStore } from '@/lib/store';

interface Quote { subtotal: number; discount: number; shipping: number; tax: number; total: number; couponCode: string | null }

const MANUAL = ['UPI_DIRECT', 'BANK_TRANSFER'];
const METHODS: Record<string, { label: string; detail: string }> = {
  UPI_DIRECT: { label: 'UPI', detail: 'Pay with any UPI app. You will see our UPI QR code and ID after placing the order.' },
  BANK_TRANSFER: { label: 'Bank transfer (NEFT / IMPS)', detail: 'Transfer to our State Bank of India account. Details are shown after placing the order.' },
  UPI: { label: 'UPI via payment gateway', detail: 'Pay instantly through our payment partner.' },
  RAZORPAY: { label: 'Cards, net banking & wallets', detail: 'Secure payment through our payment partner.' },
  CASHFREE: { label: 'Cards, net banking & wallets', detail: 'Secure payment through our payment partner.' },
  COD: { label: 'Cash on delivery', detail: 'Pay when your order is delivered.' },
};

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Distraction-free checkout: contact → delivery → billing → payment → review. */
export default function CheckoutPage() {
  const { token, user, cart, clearCart, hydrated } = useStore();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>();
  const [billingSame, setBillingSame] = useState(true);
  const [billingId, setBillingId] = useState<string>();
  const [providers, setProviders] = useState<string[]>([]);
  const [provider, setProvider] = useState<string>();
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>();
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState<Quote>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  // One key per checkout attempt: a double-click or retry returns the same order.
  const idempotencyKey = useRef(newKey());

  const items = useMemo(() => cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [cart]);

  useEffect(() => {
    if (hydrated && !token) router.replace('/login?next=/checkout');
  }, [hydrated, token, router]);

  useEffect(() => {
    if (!token) return;
    api<Address[]>('/me/addresses', { token }).then((list) => {
      setAddresses(list);
      setShowAddressForm(list.length === 0);
      setAddressId((cur) => cur ?? list.find((a) => a.isDefault)?.id ?? list[0]?.id);
    });
    api<Record<string, unknown>>('/settings').then((s) => {
      const list = [...((s['payments.enabledProviders'] as string[]) ?? [])];
      if (s['checkout.codEnabled']) list.push('COD');
      setProviders(list);
      setProvider((cur) => cur ?? list[0]);
    });
  }, [token]);

  const refreshQuote = useCallback(
    async (couponCode?: string) => {
      if (!token || !items.length) return;
      try {
        const q = await api<Quote>('/checkout/quote', { method: 'POST', token, body: JSON.stringify({ items, couponCode: couponCode || undefined }) });
        setQuote(q);
        setAppliedCoupon(q.couponCode ?? undefined);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [token, items],
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
      setShowAddressForm(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function placeOrder() {
    if (!token || !addressId || !provider || busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await api<Order>('/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({
          items,
          addressId,
          billingAddressId: billingSame ? undefined : billingId,
          paymentProvider: provider,
          couponCode: appliedCoupon,
          notes: notes || undefined,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      clearCart();
      if (provider === 'COD' || MANUAL.includes(provider)) {
        router.push(`/account/orders/${order.id}?placed=1`);
        return;
      }
      await payForOrder(order.id, token, provider);
      router.push(`/account/orders/${order.id}?placed=1`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!hydrated || !token) return <div className="container section" aria-busy="true" />;
  if (!cart.length) {
    return (
      <div className="container section" style={{ textAlign: 'center' }}>
        <h1>Nothing to check out</h1>
        <Link className="btn" href="/collections" style={{ marginTop: 20 }}>Explore collections</Link>
      </div>
    );
  }

  return (
    <div className="container section" style={{ paddingTop: 32 }}>
      <h1 style={{ marginBottom: 8 }}>Checkout</h1>
      <ol className="steps" aria-label="Checkout steps">
        <li aria-current="step">Details</li>
        <li>Payment</li>
        <li>Confirmation</li>
      </ol>
      <div className="two-col">
        <div className="stack" style={{ gap: 24 }}>
          <section className="panel" aria-labelledby="contact">
            <h2 id="contact">Contact</h2>
            <p style={{ margin: 0 }}>{user?.firstName} · {user?.email}</p>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>Order updates are sent to this email. Your delivery mobile number is taken from the address below.</p>
          </section>

          <section className="panel" aria-labelledby="delivery">
            <h2 id="delivery">Delivery address</h2>
            <div className="stack" role="radiogroup" aria-labelledby="delivery">
              {addresses.map((a) => (
                <label key={a.id} className="radio-card">
                  <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                  <span>
                    <strong>{a.fullName}</strong> · {a.phone}
                    <br />
                    <span className="muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}</span>
                  </span>
                </label>
              ))}
            </div>
            {showAddressForm ? (
              <form className="form" onSubmit={addAddress}>
                <div className="form-grid">
                  <label className="field">Full name<input className="input" name="fullName" required autoComplete="name" /></label>
                  <label className="field">Mobile number<input className="input" name="phone" required placeholder="+91" autoComplete="tel" inputMode="tel" /></label>
                  <label className="field span-2">House no., street<input className="input" name="line1" required autoComplete="address-line1" /></label>
                  <label className="field span-2">Area, locality <small>(optional)</small><input className="input" name="line2" autoComplete="address-line2" /></label>
                  <label className="field">City<input className="input" name="city" required autoComplete="address-level2" /></label>
                  <label className="field">State<input className="input" name="state" required autoComplete="address-level1" /></label>
                  <label className="field">PIN code<input className="input" name="pincode" required pattern="[1-9][0-9]{5}" inputMode="numeric" autoComplete="postal-code" /></label>
                  <label className="field">Landmark <small>(optional)</small><input className="input" name="landmark" /></label>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn--outline">Save address</button>
                  {addresses.length > 0 && <button type="button" className="btn btn--outline" onClick={() => setShowAddressForm(false)}>Cancel</button>}
                </div>
              </form>
            ) : (
              <button type="button" className="link" style={{ background: 'none', border: 0, cursor: 'pointer', justifySelf: 'start', padding: 0 }} onClick={() => setShowAddressForm(true)}>
                + Add a new address
              </button>
            )}
          </section>

          <section className="panel" aria-labelledby="billing">
            <h2 id="billing">Billing address</h2>
            <label className="check"><input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} /> Same as delivery address</label>
            {!billingSame && (
              <select className="select" value={billingId ?? ''} onChange={(e) => setBillingId(e.target.value)} aria-label="Billing address">
                <option value="" disabled>Choose a saved address</option>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.fullName}, {a.line1}, {a.city}</option>)}
              </select>
            )}
          </section>

          <section className="panel" aria-labelledby="delivery-method">
            <h2 id="delivery-method">Delivery method</h2>
            <label className="radio-card">
              <input type="radio" checked readOnly />
              <span><strong>Standard insured delivery</strong><br /><span className="muted">Dispatched after your payment is confirmed.</span></span>
            </label>
          </section>

          <section className="panel" aria-labelledby="payment">
            <h2 id="payment">Payment method</h2>
            <div className="stack" role="radiogroup" aria-labelledby="payment">
              {providers.map((p) => (
                <label key={p} className="radio-card">
                  <input type="radio" name="provider" checked={provider === p} onChange={() => setProvider(p)} />
                  <span><strong>{METHODS[p]?.label ?? p}</strong><br /><span className="muted" style={{ fontSize: '0.85rem' }}>{METHODS[p]?.detail}</span></span>
                </label>
              ))}
              {!providers.length && <p className="muted">Loading payment methods…</p>}
            </div>
            {provider && MANUAL.includes(provider) && (
              <p className="notice" style={{ margin: 0 }}>
                Your order is confirmed after we verify your payment against our bank statement. We will never ask for your UPI PIN, OTP or banking password.
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="notes-h">
            <h2 id="notes-h">Order notes <small className="muted" style={{ fontSize: '0.8rem' }}>(optional)</small></h2>
            <textarea className="textarea" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} aria-labelledby="notes-h" placeholder="Gift message, delivery instructions…" />
          </section>
        </div>

        <aside className="summary" aria-label="Order summary" style={{ position: 'sticky', top: 'calc(var(--header-h) + 20px)' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Order summary</h2>
          {cart.map((l) => (
            <div key={l.variantId} className="summary-row" style={{ fontSize: '0.88rem' }}>
              <span>{l.productName} <span className="muted">· {l.variantTitle} × {l.quantity}</span></span>
            </div>
          ))}
          {quote && (
            <>
              <div className="summary-row"><span>Subtotal</span><span>{formatPrice(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="summary-row"><span>Offer ({quote.couponCode})</span><span>−{formatPrice(quote.discount)}</span></div>}
              <div className="summary-row"><span>Delivery</span><span>{quote.shipping ? formatPrice(quote.shipping) : 'Free'}</span></div>
              <div className="summary-row summary-row--total"><span>Total</span><span>{formatPrice(quote.total)}</span></div>
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>Includes GST of {formatPrice(quote.tax)}</p>
            </>
          )}
          <form style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); void refreshQuote(coupon); }}>
            <label htmlFor="coupon" className="sr-only">Offer code</label>
            <input id="coupon" className="input" placeholder="Offer code" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
            <button className="btn btn--outline btn--sm">Apply</button>
          </form>
          {error && <p className="notice notice--error" role="alert" style={{ margin: 0 }}>{error}</p>}
          <button className="btn btn--block" disabled={busy || !addressId || !provider || !quote || (!billingSame && !billingId)} onClick={placeOrder}>
            {busy ? 'Placing order…' : 'Place order'}
          </button>
          <p className="muted" style={{ margin: 0, fontSize: '0.75rem' }}>
            By placing your order you agree to our <Link className="link" href="/pages/terms-and-conditions">terms</Link> and <Link className="link" href="/pages/refund-policy">refund policy</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
