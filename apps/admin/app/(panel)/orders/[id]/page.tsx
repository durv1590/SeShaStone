'use client';

import { use, useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { formatDate, StatusBadge } from '@/components/ui';

const NEXT_STATUSES: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
};

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  couponCode: string | null;
  trackingNumber: string | null;
  notes: string | null;
  placedAt: string;
  shippingAddress: Record<string, string | null>;
  customer: { email: string; firstName: string; lastName: string | null; phone: string | null };
  items: { id: string; productName: string; sku: string; unitPrice: number; quantity: number; lineTotal: number }[];
  payments: { id: string; provider: string; status: string; amount: number; method: string | null; providerPaymentId: string | null; createdAt: string }[];
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, error, reload } = useApi<OrderDetail>(`/admin/orders/${id}`);
  const [tracking, setTracking] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  async function move(status: string) {
    if (status === 'CANCELLED' && !confirm('Cancel this order and return its stock?')) return;
    try {
      await api(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, trackingNumber: tracking || undefined }),
      });
      setActionError(null);
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!order) return null;
  const a = order.shippingAddress;

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <span className="grow" />
        <span className="muted">{formatDate(order.placedAt)}</span>
      </div>

      <div className="panel">
        <h2>Fulfilment</h2>
        <div className="toolbar">
          {(NEXT_STATUSES[order.status] ?? []).includes('SHIPPED') && (
            <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} />
          )}
          {(NEXT_STATUSES[order.status] ?? []).map((s) => (
            <button key={s} className={`btn btn-sm ${s === 'CANCELLED' || s === 'REFUNDED' ? 'btn-danger' : ''}`} onClick={() => move(s)}>
              Mark {s.toLowerCase()}
            </button>
          ))}
          {order.trackingNumber && <span className="muted">Tracking: {order.trackingNumber}</span>}
        </div>
        {actionError && <p className="error">{actionError}</p>}
      </div>

      <div className="panel">
        <h2>Items</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Item</th><th>SKU</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.productName}</td>
                  <td>{i.sku}</td>
                  <td className="num">{formatPrice(i.unitPrice)}</td>
                  <td className="num">{i.quantity}</td>
                  <td className="num">{formatPrice(i.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <table className="table" style={{ maxWidth: 360, marginLeft: 'auto', marginTop: 12 }}>
          <tbody>
            <tr><td>Subtotal</td><td className="num">{formatPrice(order.subtotal)}</td></tr>
            {order.discount > 0 && <tr><td>Discount {order.couponCode && `(${order.couponCode})`}</td><td className="num">−{formatPrice(order.discount)}</td></tr>}
            <tr><td>Shipping</td><td className="num">{formatPrice(order.shipping)}</td></tr>
            <tr><td>GST (incl.)</td><td className="num">{formatPrice(order.tax)}</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>{formatPrice(order.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div className="form-grid">
        <div className="panel">
          <h2>Customer</h2>
          <p>{order.customer.firstName} {order.customer.lastName}<br />{order.customer.email}<br />{order.customer.phone}</p>
          {order.notes && <p className="muted">Note: {order.notes}</p>}
        </div>
        <div className="panel">
          <h2>Ship to</h2>
          <p>
            {a.fullName} · {a.phone}<br />
            {a.line1}{a.line2 && `, ${a.line2}`}<br />
            {a.city}, {a.state} {a.pincode}
          </p>
        </div>
      </div>

      <div className="panel">
        <h2>Payments</h2>
        {order.payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Provider</th><th>Method</th><th>Reference</th><th>Status</th><th>Date</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.provider}</td>
                    <td>{p.method ?? '—'}</td>
                    <td>{p.providerPaymentId ?? '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{formatDate(p.createdAt)}</td>
                    <td className="num">{formatPrice(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No payment attempts yet.</p>
        )}
      </div>
    </>
  );
}
