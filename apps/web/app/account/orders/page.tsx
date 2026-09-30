'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AccountShell } from '@/components/account-shell';
import { StatusPill } from '@/components/ui';
import { api, Order, Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function OrdersPage() {
  const { token } = useStore();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Paginated<Order>>('/me/orders?pageSize=50', { token }).then((r) => setOrders(r.items)).catch((e) => setError(e.message));
  }, [token]);

  return (
    <AccountShell title="My Orders">
      {error && <p className="error" role="alert">{error}</p>}
      {orders?.length === 0 && (
        <div className="empty">
          <p>You haven’t placed any orders yet.</p>
          <Link href="/collections/new-arrivals" className="link">Discover new arrivals</Link>
        </div>
      )}
      {!!orders?.length && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th /></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/account/orders/${o.id}`} className="link">{o.orderNumber}</Link><br /><span className="muted" style={{ fontSize: '0.78rem' }}>{o.items.length} item{o.items.length > 1 ? 's' : ''}</span></td>
                  <td>{new Date(o.placedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td className="price">{formatPrice(o.total)}</td>
                  <td>{o.status === 'PENDING_PAYMENT' ? <Link href={`/account/orders/${o.id}`} className="btn btn--sm">Pay now</Link> : <Link href={`/account/orders/${o.id}`} className="link">View</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountShell>
  );
}
