'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { FormEvent, Suspense, use, useCallback, useEffect, useState } from 'react';
import { api, Order, PaymentInstructions } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="chip"
      style={{ padding: '2px 10px', marginLeft: 8, fontSize: '0.8rem' }}
      onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true))}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function PayManually({ orderId, token }: { orderId: string; token: string }) {
  const [info, setInfo] = useState<PaymentInstructions | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<PaymentInstructions>(`/me/orders/${orderId}/payment-instructions`, { token })
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [orderId, token]);

  useEffect(() => {
    if (info?.upi) QRCode.toDataURL(info.upi.uri, { width: 400, margin: 1 }).then(setQr);
  }, [info?.upi]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reference = String(new FormData(e.currentTarget).get('reference') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      setInfo(
        await api<PaymentInstructions>(`/me/orders/${orderId}/payment-reference`, {
          method: 'POST',
          token,
          body: JSON.stringify({ reference }),
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!info || info.orderStatus !== 'PENDING_PAYMENT') return null;

  return (
    <section className="summary" style={{ gap: 20 }}>
      <h2 style={{ margin: 0 }}>
        Pay {formatPrice(info.amount)} by {info.upi ? 'UPI' : 'bank transfer'}
      </h2>

      {info.upi && (
        <div className="pay-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img className="qr" src={qr} alt={`UPI QR code to pay ${info.upi.upiId}`} />}
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0 }}>Scan with GPay, PhonePe, Paytm or any UPI app. The amount is filled in for you.</p>
            <dl className="kv">
              <dt>UPI ID</dt>
              <dd>{info.upi.upiId}<CopyButton value={info.upi.upiId} /></dd>
              <dt>Name</dt>
              <dd>{info.upi.payeeName}</dd>
              <dt>Amount</dt>
              <dd>{formatPrice(info.amount)}</dd>
            </dl>
            <a className="btn" href={info.upi.uri} style={{ justifySelf: 'start' }}>Open UPI app</a>
          </div>
        </div>
      )}

      {info.bank && (
        <dl className="kv">
          <dt>Bank</dt>
          <dd>{info.bank.bankName}</dd>
          <dt>Account name</dt>
          <dd>{info.bank.accountName}</dd>
          <dt>Account no.</dt>
          <dd>{info.bank.accountNumber}<CopyButton value={info.bank.accountNumber} /></dd>
          <dt>IFSC</dt>
          <dd>{info.bank.ifsc}<CopyButton value={info.bank.ifsc} /></dd>
          <dt>Amount</dt>
          <dd>{formatPrice(info.amount)}</dd>
          <dt>Remarks</dt>
          <dd>{info.reference}</dd>
        </dl>
      )}

      {info.submittedReference ? (
        <p className="notice" style={{ margin: 0 }}>
          Thanks! We received your reference <strong>{info.submittedReference}</strong> and will confirm your
          payment shortly. Your order ships once it is confirmed.
        </p>
      ) : (
        <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
          <label className="field">
            After paying, enter the UTR / UPI transaction ID from your app
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" name="reference" placeholder="e.g. 427812345678" required minLength={6} />
              <button className="btn" disabled={busy}>Submit</button>
            </div>
          </label>
          {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            Pieces are held for you while we wait for payment.
          </p>
        </form>
      )}
    </section>
  );
}

function OrderView({ id }: { id: string }) {
  const { token } = useStore();
  const placed = useSearchParams().get('placed');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrder(await api<Order>(`/me/orders/${id}`, { token }));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) {
    return <p>Please <Link href={`/login?next=/account/orders/${id}`}>login</Link> to see this order.</p>;
  }
  if (error) return <p className="error">{error}</p>;
  if (!order) return null;

  const manual = order.payments?.some((p) => p.provider === 'UPI_DIRECT' || p.provider === 'BANK_TRANSFER');

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {placed && <p className="notice" style={{ margin: 0 }}>Thank you! Order <strong>{order.orderNumber}</strong> has been placed.</p>}
      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h1 className="section-title" style={{ margin: 0 }}>Order {order.orderNumber}</h1>
        <span className="muted">{order.status.replace(/_/g, ' ').toLowerCase()}</span>
      </div>

      {manual && order.status === 'PENDING_PAYMENT' && <PayManually orderId={order.id} token={token} />}

      <table className="table">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id}><td>{i.productName}</td><td>{i.quantity}</td><td>{formatPrice(i.lineTotal)}</td></tr>
          ))}
          {order.discount > 0 && <tr><td colSpan={2}>Discount</td><td>−{formatPrice(order.discount)}</td></tr>}
          <tr><td colSpan={2}>Shipping</td><td>{order.shipping ? formatPrice(order.shipping) : 'Free'}</td></tr>
          <tr><td colSpan={2}><strong>Total</strong></td><td><strong>{formatPrice(order.total)}</strong></td></tr>
        </tbody>
      </table>
      <Link href="/account/orders" className="muted">← All orders</Link>
    </div>
  );
}

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="container section">
      <Suspense>
        <OrderView id={id} />
      </Suspense>
    </div>
  );
}
