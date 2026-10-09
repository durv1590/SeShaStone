'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { formatDate, Pager, StatusBadge } from '@/components/ui';

const STATUSES = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED', 'REFUNDED'];

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  placedAt: string;
  customer: { email: string; firstName: string };
  _count: { items: number };
}

function Orders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(useSearchParams().get('status') ?? '');
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }), ...(q && { q }) });
  const { data, error } = useApi<Paginated<OrderRow>>(`/admin/orders?${params}`);

  return (
    <>
      <h1>Orders</h1>
      <div className="toolbar">
        <input className="input" placeholder="Order no., email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Placed</th><th className="num">Items</th><th>Status</th><th className="num">Total</th></tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`}>{o.orderNumber}</Link></td>
                <td>{o.customer.firstName} · {o.customer.email}</td>
                <td>{formatDate(o.placedAt)}</td>
                <td className="num">{o._count.items}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="num">{formatPrice(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}

export default function OrdersPage() {
  return <Suspense><Orders /></Suspense>;
}
