'use client';

import { useState } from 'react';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { formatDate, Pager, StatusBadge } from '@/components/ui';

interface PaymentRow {
  id: string;
  provider: string;
  status: string;
  amount: number;
  method: string | null;
  providerPaymentId: string | null;
  createdAt: string;
  order: { orderNumber: string };
}

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const { data, error } = useApi<Paginated<PaymentRow>>(`/admin/payments?${params}`);

  return (
    <>
      <h1>Payments</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Provider</th><th>Method</th><th>Reference</th><th>Status</th><th>Date</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td>{p.order.orderNumber}</td>
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
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
