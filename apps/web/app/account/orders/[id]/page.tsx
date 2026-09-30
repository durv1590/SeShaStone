'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, use, useCallback, useEffect, useState } from 'react';
import { AccountShell } from '@/components/account-shell';
import { OrderPayment } from '@/components/order-payment';
import { StatusPill, statusLabel } from '@/components/ui';
import { api, Order, PaymentInstructions } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

const FLOW = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const MANUAL = ['UPI_DIRECT', 'BANK_TRANSFER'];

function Timeline({ status }: { status: string }) {
  const idx = FLOW.indexOf(status);
  if (idx < 0) return <p><StatusPill status={status} /></p>;
  return (
    <ol className="timeline" aria-label="Order progress">
      {FLOW.map((s, i) => (
        <li key={s} className={i <= idx ? 'is-done' : ''} aria-current={i === idx ? 'step' : undefined}>
          {s === 'PAID' ? 'Payment verified — order confirmed' : statusLabel(s)}
        </li>
      ))}
    </ol>
  );
}

function OrderView({ id }: { id: string }) {
  const { token } = useStore();
  const placed = useSearchParams().get('placed');
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<PaymentInstructions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const o = await api<Order>(`/me/orders/${id}`, { token });
      setOrder(o);
      if (o.status === 'PENDING_PAYMENT' && o.payments?.some((p) => MANUAL.includes(p.provider))) {
        setPayment(await api<PaymentInstructions>(`/me/orders/${id}/payment-instructions`, { token }));
      } else setPayment(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, token]);
  useEffect(() => { void load(); }, [load]);

  async function cancel() {
    if (!confirm('Cancel this order?')) return;
    setBusy(true);
    try {
      setOrder(await api<Order>(`/me/orders/${id}/cancel`, { method: 'POST', token }));
      setPayment(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function requestReturn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
    setBusy(true);
    try {
      setOrder(await api<Order>(`/me/orders/${id}/return`, { method: 'POST', token, body: JSON.stringify({ reason }) }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="error" role="alert">{error}</p>;
  if (!order) return <p className="muted" aria-busy="true">Loading…</p>;
  const a = order.shippingAddress;
  const canReturn = order.status === 'DELIVERED' && order.returnEligibleUntil && new Date(order.returnEligibleUntil) > new Date();
  const manual = order.payments?.find((p) => MANUAL.includes(p.provider));

  return (
    <div className="stack" style={{ gap: 24 }}>
      {placed && (
        <p className="notice notice--success" role="status" style={{ margin: 0 }}>
          Thank you! Order <strong>{order.orderNumber}</strong> has been placed.
          {manual && order.status === 'PENDING_PAYMENT' && ' Complete your payment below — your order is confirmed once we verify it.'}
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2>Order {order.orderNumber}</h2>
        <StatusPill status={order.status} />
      </div>

      {payment && token && <OrderPayment orderId={order.id} token={token} initial={payment} onChange={load} />}

      <div className="two-col" style={{ gap: 24 }}>
        <section className="panel" aria-labelledby="items">
          <h3 id="items">Items</h3>
          {order.items.map((i) => (
            <div key={i.id} className="summary-row" style={{ fontSize: '0.9rem' }}>
              <span>{i.productName} <span className="muted">× {i.quantity}</span></span>
              <span>{formatPrice(i.lineTotal)}</span>
            </div>
          ))}
          <div className="summary-row"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          {order.discount > 0 && <div className="summary-row"><span>Offer{order.couponCode ? ` (${order.couponCode})` : ''}</span><span>−{formatPrice(order.discount)}</span></div>}
          <div className="summary-row"><span>Delivery</span><span>{order.shipping ? formatPrice(order.shipping) : 'Free'}</span></div>
          <div className="summary-row summary-row--total"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>Includes GST of {formatPrice(order.tax)}</p>
        </section>
        <section className="panel" aria-labelledby="progress">
          <h3 id="progress">Progress</h3>
          <Timeline status={order.status} />
          {order.trackingNumber && <p style={{ margin: 0 }}>Tracking: <strong>{order.trackingNumber}</strong>{order.courier && ` (${order.courier})`}</p>}
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Delivering to {a.fullName}, {a.line1}, {a.city}, {a.state} {a.pincode}
          </p>
        </section>
      </div>

      {!!order.refunds?.length && (
        <section className="panel" aria-labelledby="refunds">
          <h3 id="refunds">Refunds</h3>
          {order.refunds.map((r) => (
            <div key={r.id} className="summary-row">
              <span>{formatPrice(r.amount)} {r.reference && <span className="muted">· ref {r.reference}</span>}</span>
              <StatusPill status={r.status} />
            </div>
          ))}
        </section>
      )}

      {order.returnRequests?.map((r) => (
        <p key={r.id} className="notice" style={{ margin: 0 }}>
          Return {r.status.toLowerCase()}: {r.reason}{r.adminNote && ` — ${r.adminNote}`}
        </p>
      ))}

      {canReturn && (
        <form className="panel" onSubmit={requestReturn}>
          <h3>Request a return</h3>
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Available until {new Date(order.returnEligibleUntil!).toLocaleDateString('en-IN', { dateStyle: 'medium' })}. See our <Link className="link" href="/pages/return-policy">return policy</Link>.
          </p>
          <label className="field">Reason<textarea className="textarea" name="reason" required minLength={5} maxLength={1000} /></label>
          <div><button className="btn btn--outline" disabled={busy}>Request return</button></div>
        </form>
      )}

      {error && <p className="error" role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/account/orders" className="link muted">← All orders</Link>
        {order.status === 'PENDING_PAYMENT' && (
          <button type="button" className="link muted" style={{ background: 'none', border: 0, cursor: 'pointer' }} disabled={busy} onClick={cancel}>
            Cancel order
          </button>
        )}
        <Link href="/pages/contact" className="link muted">Need help?</Link>
      </div>
    </div>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AccountShell title="Order details">
      <Suspense>
        <OrderView id={id} />
      </Suspense>
    </AccountShell>
  );
}
