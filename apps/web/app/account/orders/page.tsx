'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, Order, Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { payForOrder } from '@/lib/payments';
import { useStore } from '@/lib/store';

function Orders() {
  const { token } = useStore();
  const placed = useSearchParams().get('placed');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      setOrders((await api<Paginated<Order>>('/me/orders', { token })).items);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <p>
        Please <Link href="/login?next=/account/orders">login</Link> to see your orders.
      </p>
    );
  }

  return (
    <>
      {placed && <p className="summary">Thank you! Order <strong>{placed}</strong> has been placed.</p>}
      {error && <p className="error">{error}</p>}
      {orders?.length === 0 && <p className="muted">You haven&apos;t placed any orders yet.</p>}
      {!!orders?.length && (
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{new Date(o.placedAt).toLocaleDateString('en-IN')}</td>
                <td>{o.items.map((i) => `${i.productName} × ${i.quantity}`).join(', ')}</td>
                <td>{formatPrice(o.total)}</td>
                <td>{o.status.replace('_', ' ').toLowerCase()}</td>
                <td>
                  {o.status === 'PENDING_PAYMENT' && (
                    <button
                      className="chip"
                      onClick={() =>
                        payForOrder(o.id, token).then(load, (e) => setError(e.message))
                      }
                    >
                      Pay now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <div className="container section">
      <h1 className="section-title">My orders</h1>
      <Suspense>
        <Orders />
      </Suspense>
    </div>
  );
}
