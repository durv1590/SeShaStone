'use client';

import { FormEvent, use, useState } from 'react';
import { EvidenceLinks, EvidenceMeta, ManualPaymentActions } from '@/components/manual-payment-actions';
import { useSession } from '@/components/session';
import { formatDate, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatPrice, rupeesToPaise } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/** Mirrors the API transition table (apps/api/src/orders/order-lifecycle.ts). */
const NEXT: Record<string, string[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'PACKED', 'CANCELLED'],
  PROCESSING: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
};
const ACTION_LABEL: Record<string, string> = {
  PROCESSING: 'Start processing',
  PACKED: 'Mark packed',
  SHIPPED: 'Mark shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark delivered',
  CANCELLED: 'Cancel order',
  RETURN_REQUESTED: 'Log return request',
  RETURNED: 'Return received (restock)',
};

interface Payment {
  id: string;
  provider: string;
  status: string;
  amount: number;
  method: string | null;
  providerPaymentId: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  refundedAmount: number;
  createdAt: string;
  evidence: EvidenceMeta[];
}

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
  courier: string | null;
  notes: string | null;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  shippingAddress: Record<string, string | null>;
  billingAddress: Record<string, string | null> | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customer: { email: string; firstName: string; lastName: string | null; phone: string | null };
  items: { id: string; productName: string; sku: string; unitPrice: number; quantity: number; lineTotal: number }[];
  payments: Payment[];
  refunds: { id: string; amount: number; reason: string; status: string; method: string | null; reference: string | null; processedAt: string | null; createdAt: string }[];
  returnRequests: { id: string; reason: string; status: string; adminNote: string | null; createdAt: string }[];
  notifications: { id: string; template: string; status: string; recipient: string; error: string | null; createdAt: string }[];
  history: { id: string; action: string; actorEmail: string | null; before: Record<string, unknown> | null; after: Record<string, unknown> | null; createdAt: string }[];
}

function Address({ a }: { a: Record<string, string | null> }) {
  return <p style={{ margin: 0 }}>{a.fullName} · {a.phone}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}</p>;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useSession();
  const { data: order, error, reload } = useApi<OrderDetail>(`/admin/orders/${id}`);
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  async function move(status: string) {
    let reason: string | undefined;
    if (status === 'CANCELLED') {
      const paid = order?.payments.some((p) => ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(p.status));
      if (!confirm(`Cancel this order and return its stock?${paid ? '\n\nThe customer has paid — create a refund afterwards.' : ''}`)) return;
      reason = prompt('Reason for cancellation (shared with the customer)') ?? undefined;
    }
    if (status === 'DELIVERED' && order?.status === 'RETURN_REQUESTED') {
      reason = prompt('Reason for rejecting the return (shared with the customer)') ?? undefined;
      if (!reason) return;
    }
    if (status === 'RETURNED') reason = prompt('Note on the returned item (condition etc.)') ?? undefined;
    try {
      await api(`/admin/orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, trackingNumber: tracking || undefined, courier: courier || undefined, reason }),
      });
      setActionError(null);
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function createRefund(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const amount = rupeesToPaise(String(f.get('amount')));
    if (!Number.isFinite(amount) || amount <= 0) return setActionError('Enter a valid refund amount');
    const processed = f.get('processed') === 'on';
    if (!confirm(`Record a refund of ${formatPrice(amount)}${processed ? ' as already paid out' : ''}?`)) return;
    try {
      await api(`/admin/orders/${id}/refunds`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          reason: f.get('reason'),
          method: f.get('method') || undefined,
          reference: f.get('reference') || undefined,
          processed,
        }),
      });
      form.reset();
      setActionError(null);
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function processRefund(refundId: string, status: 'PROCESSED' | 'FAILED') {
    const reference = status === 'PROCESSED' ? prompt('Refund transfer reference (UTR)') : undefined;
    if (status === 'PROCESSED' && !reference) return;
    try {
      await api(`/admin/refunds/${refundId}`, { method: 'PATCH', body: JSON.stringify({ status, reference: reference ?? undefined }) });
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!order) return null;
  const next = can('orders.manage') ? NEXT[order.status] ?? [] : [];
  const received = order.payments.filter((p) => ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)).reduce((n, p) => n + p.amount, 0);
  const committed = order.refunds.filter((r) => r.status !== 'FAILED').reduce((n, r) => n + r.amount, 0);
  const refundable = Math.max(0, received - committed);

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <span className="grow" />
        <span className="muted">Placed {formatDate(order.placedAt)}</span>
      </div>

      {actionError && <p className="notice bad" role="alert">{actionError}</p>}

      {next.length > 0 && (
        <div className="panel">
          <h2>Fulfilment</h2>
          <div className="toolbar">
            {next.includes('SHIPPED') && (
              <>
                <input className="input" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="Tracking number" />
                <input className="input" placeholder="Courier" value={courier} onChange={(e) => setCourier(e.target.value)} aria-label="Courier" />
              </>
            )}
            {next.map((s) => (
              <button key={s} className={`btn btn-sm ${s === 'CANCELLED' || (s === 'DELIVERED' && order.status === 'RETURN_REQUESTED') ? 'btn-danger' : ''}`} onClick={() => move(s)}>
                {s === 'DELIVERED' && order.status === 'RETURN_REQUESTED' ? 'Reject return' : ACTION_LABEL[s] ?? s}
              </button>
            ))}
          </div>
          {order.trackingNumber && <p className="muted" style={{ marginBottom: 0 }}>Tracking: {order.trackingNumber}{order.courier && ` (${order.courier})`}</p>}
        </div>
      )}

      <div className="panel">
        <h2>Payments</h2>
        {order.payments.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Method</th><th>UTR / reference</th><th>Proof</th><th>Status</th><th>Submitted</th><th>Verified</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {order.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.provider.replace('_', ' ').toLowerCase()}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.providerPaymentId ?? '—'}{p.rejectionReason && <div className="muted" style={{ fontFamily: 'inherit' }}>Last rejected: {p.rejectionReason}</div>}</td>
                    <td><EvidenceLinks evidence={p.evidence} />{!p.evidence.length && '—'}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{formatDate(p.submittedAt)}</td>
                    <td>{formatDate(p.verifiedAt)}</td>
                    <td className="num">{formatPrice(p.amount)}{p.refundedAmount > 0 && <div className="muted">−{formatPrice(p.refundedAmount)} refunded</div>}</td>
                    <td><ManualPaymentActions payment={p} onDone={reload} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="muted">No payment attempts yet.</p>}
      </div>

      <div className="panel">
        <h2>Items</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>SKU</th><th className="num">Price</th><th className="num">Qty</th><th className="num">Total</th></tr></thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}><td>{i.productName}</td><td>{i.sku}</td><td className="num">{formatPrice(i.unitPrice)}</td><td className="num">{i.quantity}</td><td className="num">{formatPrice(i.lineTotal)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <table className="table" style={{ maxWidth: 380, marginLeft: 'auto', marginTop: 12 }}>
          <tbody>
            <tr><td>Subtotal</td><td className="num">{formatPrice(order.subtotal)}</td></tr>
            {order.discount > 0 && <tr><td>Discount {order.couponCode && `(${order.couponCode})`}</td><td className="num">−{formatPrice(order.discount)}</td></tr>}
            <tr><td>Shipping</td><td className="num">{formatPrice(order.shipping)}</td></tr>
            <tr><td>GST (included)</td><td className="num">{formatPrice(order.tax)}</td></tr>
            <tr><td><strong>Total</strong></td><td className="num"><strong>{formatPrice(order.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Customer</h2>
          <p style={{ margin: 0 }}>{order.customer.firstName} {order.customer.lastName}<br />{order.customerEmail ?? order.customer.email}<br />{order.customerPhone ?? order.customer.phone}</p>
          {order.notes && <p className="notice" style={{ marginBottom: 0 }}>Customer note: {order.notes}</p>}
        </div>
        <div className="panel">
          <h2>Ship to</h2>
          <Address a={order.shippingAddress} />
          {order.billingAddress && <><h3>Bill to</h3><Address a={order.billingAddress} /></>}
        </div>
      </div>

      {order.returnRequests.length > 0 && (
        <div className="panel">
          <h2>Return requests</h2>
          {order.returnRequests.map((r) => (
            <p key={r.id}><StatusBadge status={r.status} /> {formatDate(r.createdAt)} — {r.reason}{r.adminNote && <span className="muted"> · {r.adminNote}</span>}</p>
          ))}
        </div>
      )}

      <div className="panel">
        <h2>Refunds</h2>
        {order.refunds.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="table">
              <thead><tr><th>Created</th><th>Reason</th><th>Method</th><th>Reference</th><th>Status</th><th className="num">Amount</th><th /></tr></thead>
              <tbody>
                {order.refunds.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>{r.reason}</td>
                    <td>{r.method ?? '—'}</td>
                    <td>{r.reference ?? '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className="num">{formatPrice(r.amount)}</td>
                    <td>{r.status === 'PENDING' && can('refunds.manage') && (
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => processRefund(r.id, 'PROCESSED')}>Mark paid out</button>
                        <button className="btn btn-sm btn-danger" onClick={() => processRefund(r.id, 'FAILED')}>Failed</button>
                      </span>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {can('refunds.manage') && refundable > 0 ? (
          <form className="form" onSubmit={createRefund}>
            <p className="muted" style={{ margin: 0 }}>Up to {formatPrice(refundable)} can be refunded. Send the money from your bank/UPI first, then record it here with the transfer reference.</p>
            <div className="form-grid">
              <label className="field">Amount (₹)<input className="input" name="amount" required inputMode="decimal" defaultValue={String(refundable / 100)} /></label>
              <label className="field">Method<select name="method" defaultValue="upi"><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="original_method">Original method</option><option value="cash">Cash</option></select></label>
              <label className="field">Reference (UTR)<input className="input" name="reference" /></label>
              <label className="field">Reason<input className="input" name="reason" required minLength={3} /></label>
            </div>
            <label className="check"><input type="checkbox" name="processed" /> Already paid out (reference required)</label>
            <div><button className="btn btn-sm">Record refund</button></div>
          </form>
        ) : <p className="muted" style={{ margin: 0 }}>{received ? 'Fully refunded.' : 'No verified payment to refund.'}</p>}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Notifications</h2>
          {order.notifications.length ? order.notifications.map((n) => (
            <p key={n.id} style={{ margin: '4px 0', fontSize: '0.85rem' }}>
              <StatusBadge status={n.status} /> {n.template} → {n.recipient} <span className="muted">· {formatDate(n.createdAt)}</span>
              {n.error && <span className="muted" style={{ display: 'block' }}>{n.error}</span>}
            </p>
          )) : <p className="muted">None.</p>}
        </div>
        <div className="panel">
          <h2>History</h2>
          {order.history.map((h) => (
            <p key={h.id} style={{ margin: '4px 0', fontSize: '0.85rem' }}>
              <strong>{h.action}</strong> {h.after && <span className="muted">{JSON.stringify(h.after)}</span>}<br />
              <span className="muted">{h.actorEmail ?? 'customer / system'} · {formatDate(h.createdAt)}</span>
            </p>
          ))}
        </div>
      </div>
    </>
  );
}
