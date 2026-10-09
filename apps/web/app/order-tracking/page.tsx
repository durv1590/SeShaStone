'use client';

import { FormEvent, useState } from 'react';
import { StatusPill } from '@/components/ui';
import { api } from '@/lib/api';

interface Tracking {
  orderNumber: string;
  status: string;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  courier: string | null;
  itemCount: number;
}

const date = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : null);

export default function OrderTrackingPage() {
  const [result, setResult] = useState<Tracking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function track(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      setResult(await api<Tracking>('/orders/track', { method: 'POST', body: JSON.stringify({ orderNumber: f.get('orderNumber'), email: f.get('email') }) }));
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Customer care</p>
      <h1 style={{ marginBottom: 12 }}>Track your order</h1>
      <p className="muted">Enter your order number (for example SSS-260930-123456) and the email address used for the order.</p>
      <form className="form" onSubmit={track}>
        <label className="field">Order number<input className="input" name="orderNumber" required autoComplete="off" style={{ textTransform: 'uppercase' }} /></label>
        <label className="field">Email address<input className="input" name="email" type="email" required autoComplete="email" /></label>
        <div><button className="btn" disabled={busy}>{busy ? 'Checking…' : 'Track order'}</button></div>
      </form>
      {error && <p className="notice notice--error" role="alert" style={{ marginTop: 20 }}>{error}</p>}
      {result && (
        <section className="panel" style={{ marginTop: 24 }} aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2>{result.orderNumber}</h2>
            <StatusPill status={result.status} />
          </div>
          <dl className="kv">
            <dt>Placed</dt><dd>{date(result.placedAt)}</dd>
            {result.shippedAt && <><dt>Shipped</dt><dd>{date(result.shippedAt)}</dd></>}
            {result.deliveredAt && <><dt>Delivered</dt><dd>{date(result.deliveredAt)}</dd></>}
            {result.trackingNumber && <><dt>Tracking</dt><dd>{result.trackingNumber}{result.courier && ` · ${result.courier}`}</dd></>}
            <dt>Items</dt><dd>{result.itemCount}</dd>
          </dl>
        </section>
      )}
    </div>
  );
}
