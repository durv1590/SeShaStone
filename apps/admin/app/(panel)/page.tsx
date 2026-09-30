'use client';

import Link from 'next/link';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { formatDate, StatusBadge } from '@/components/ui';

interface Stats {
  last30Days: { revenue: number; orders: number; newCustomers: number };
  ordersByStatus: Record<string, number>;
}

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  placedAt: string;
  customer: { email: string };
}

export default function DashboardPage() {
  const stats = useApi<Stats>('/admin/dashboard');
  const recent = useApi<Paginated<OrderRow>>('/admin/orders?pageSize=8');
  const lowStock = useApi<Paginated<unknown>>('/admin/inventory?lowStock=true&pageSize=1');
  const toVerify = useApi<Paginated<{ provider: string; providerPaymentId: string | null }>>(
    '/admin/payments?status=PENDING&pageSize=100',
  );
  const awaitingConfirmation = toVerify.data?.items.filter(
    (p) => (p.provider === 'UPI_DIRECT' || p.provider === 'BANK_TRANSFER') && p.providerPaymentId,
  ).length;
  const s = stats.data;

  return (
    <>
      <h1>Dashboard</h1>
      {stats.error && <p className="error">{stats.error}</p>}
      <div className="stats">
        <div className="stat">
          <div className="label">Revenue · 30 days</div>
          <div className="value">{s ? formatPrice(s.last30Days.revenue) : '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Paid orders · 30 days</div>
          <div className="value">{s?.last30Days.orders ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">New customers · 30 days</div>
          <div className="value">{s?.last30Days.newCustomers ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">To fulfil</div>
          <div className="value">{s ? (s.ordersByStatus.PAID ?? 0) + (s.ordersByStatus.PROCESSING ?? 0) : '—'}</div>
        </div>
        <Link href="/payments?status=PENDING" className="stat">
          <div className="label">UPI / bank payments to confirm</div>
          <div className="value">{awaitingConfirmation ?? '—'}</div>
        </Link>
        <Link href="/inventory?lowStock=true" className="stat">
          <div className="label">Low-stock variants</div>
          <div className="value">{lowStock.data?.total ?? '—'}</div>
        </Link>
      </div>

      <div className="panel">
        <h2>Recent orders</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th className="num">Total</th></tr>
            </thead>
            <tbody>
              {recent.data?.items.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/orders/${o.id}`}>{o.orderNumber}</Link></td>
                  <td>{o.customer.email}</td>
                  <td>{formatDate(o.placedAt)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="num">{formatPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
