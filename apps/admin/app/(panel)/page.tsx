'use client';

import Link from 'next/link';
import { useSession } from '@/components/session';
import { formatDate, StatusBadge } from '@/components/ui';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Stats {
  last30Days: { revenue: number; paidOrders: number; verifiedPayments: number };
  totals: {
    orders: number;
    customers: number;
    activeProducts: number;
    pendingOrders: number;
    awaitingPayment: number;
    paymentsToVerify: number;
    pendingRefunds: number;
    returnRequests: number;
    lowStock: number;
    activeCampaigns: number;
  };
}

interface OrderRow { id: string; orderNumber: string; status: string; total: number; placedAt: string; customer: { email: string } }

function Stat({ label, value, href, alert }: { label: string; value: React.ReactNode; href?: string; alert?: boolean }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="value" style={alert ? { color: 'var(--danger)' } : undefined}>{value}</div>
    </>
  );
  return href ? <Link href={href} className="stat">{body}</Link> : <div className="stat">{body}</div>;
}

export default function DashboardPage() {
  const { can } = useSession();
  const { data: s, error } = useApi<Stats>('/admin/dashboard');
  const recent = useApi<Paginated<OrderRow>>(can('orders.view') ? '/admin/orders?pageSize=8' : null);
  const t = s?.totals;

  return (
    <>
      <h1>Dashboard</h1>
      {error && <p className="error">{error}</p>}
      <div className="stats">
        <Stat label="Revenue · 30 days" value={s ? formatPrice(s.last30Days.revenue) : '—'} />
        <Stat label="Total orders" value={t?.orders ?? '—'} href="/orders" />
        <Stat label="To fulfil (confirmed, processing, packed)" value={t?.pendingOrders ?? '—'} href="/orders" />
        <Stat label="Payments to verify" value={t?.paymentsToVerify ?? '—'} href="/payments?status=SUBMITTED" alert={!!t?.paymentsToVerify} />
        <Stat label="Awaiting customer payment" value={t?.awaitingPayment ?? '—'} href="/payments?status=PENDING" />
        <Stat label="Verified payments · 30 days" value={s?.last30Days.verifiedPayments ?? '—'} href="/payments?status=CAPTURED" />
        <Stat label="Pending refunds" value={t?.pendingRefunds ?? '—'} href="/refunds" alert={!!t?.pendingRefunds} />
        <Stat label="Return requests" value={t?.returnRequests ?? '—'} href="/orders?status=RETURN_REQUESTED" />
        <Stat label="Customers" value={t?.customers ?? '—'} href="/customers" />
        <Stat label="Active products" value={t?.activeProducts ?? '—'} href="/products" />
        <Stat label="Low stock variants" value={t?.lowStock ?? '—'} href="/inventory?lowStock=true" alert={!!t?.lowStock} />
        <Stat label="Active campaigns" value={t?.activeCampaigns ?? '—'} href="/cms" />
      </div>

      {recent.data && (
        <div className="panel">
          <h2>Recent orders</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th className="num">Total</th></tr></thead>
              <tbody>
                {recent.data.items.map((o) => (
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
      )}
    </>
  );
}
