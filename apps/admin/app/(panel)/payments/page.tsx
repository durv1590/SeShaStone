'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import Link from 'next/link';
import { MANUAL_PROVIDERS, ManualPaymentActions } from '@/components/manual-payment-actions';
import { formatDate, Pager, StatusBadge } from '@/components/ui';

interface PaymentRow {
  id: string;
  provider: string;
  status: string;
  amount: number;
  method: string | null;
  providerPaymentId: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string };
}

function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(useSearchParams().get('status') ?? '');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const { data, error, reload } = useApi<Paginated<PaymentRow>>(`/admin/payments?${params}`);

  return (
    <>
      <h1>Payments</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="PENDING">Awaiting confirmation</option>
          {['CAPTURED', 'FAILED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Method</th><th>Reference / UTR</th><th>Status</th><th>Date</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/orders/${p.order.id}`}>{p.order.orderNumber}</Link></td>
                <td>{p.provider.replace('_', ' ').toLowerCase()}{p.method && !MANUAL_PROVIDERS.includes(p.provider) ? ` · ${p.method}` : ''}</td>
                <td>{p.providerPaymentId ?? '—'}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{formatDate(p.createdAt)}</td>
                <td className="num">{formatPrice(p.amount)}</td>
                <td><ManualPaymentActions payment={p} onDone={reload} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense>
      <Payments />
    </Suspense>
  );
}
