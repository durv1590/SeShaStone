'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { MANUAL_PROVIDERS, ManualPaymentActions } from '@/components/manual-payment-actions';
import { formatDate, Pager, StatusBadge } from '@/components/ui';
import { Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface PaymentRow {
  id: string;
  provider: string;
  status: string;
  amount: number;
  method: string | null;
  providerPaymentId: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  refundedAmount: number;
  createdAt: string;
  order: { id: string; orderNumber: string; status: string };
  _count: { evidence: number };
}

const STATUSES: [string, string][] = [
  ['SUBMITTED', 'To verify (UTR / proof submitted)'],
  ['PENDING', 'Awaiting payment'],
  ['CAPTURED', 'Paid'],
  ['PARTIALLY_REFUNDED', 'Partially refunded'],
  ['REFUNDED', 'Refunded'],
  ['EXPIRED', 'Expired'],
  ['FAILED', 'Failed'],
  ['', 'All'],
];

function Payments() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(useSearchParams().get('status') ?? 'SUBMITTED');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const { data, error, reload } = useApi<Paginated<PaymentRow>>(`/admin/payments?${params}`);

  return (
    <>
      <h1>Payments</h1>
      <p className="muted" style={{ marginTop: -12 }}>
        Match each UTR against the actual bank or UPI statement before verifying. Open the order to see uploaded proof.
      </p>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Payment status">
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Method</th><th>UTR / reference</th><th>Proof</th><th>Status</th><th>Submitted</th><th className="num">Amount</th><th /></tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/orders/${p.order.id}`}>{p.order.orderNumber}</Link></td>
                <td>{p.provider.replace('_', ' ').toLowerCase()}{p.method && !MANUAL_PROVIDERS.includes(p.provider) ? ` · ${p.method}` : ''}</td>
                <td style={{ fontFamily: 'monospace' }}>{p.providerPaymentId ?? '—'}</td>
                <td>{p._count.evidence ? <Link href={`/orders/${p.order.id}`}>{p._count.evidence} file{p._count.evidence > 1 ? 's' : ''}</Link> : '—'}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{formatDate(p.submittedAt ?? p.createdAt)}</td>
                <td className="num">{formatPrice(p.amount)}</td>
                <td><ManualPaymentActions payment={p} onDone={reload} /></td>
              </tr>
            ))}
            {data?.items.length === 0 && <tr><td colSpan={8} className="muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}

export default function PaymentsPage() {
  return <Suspense><Payments /></Suspense>;
}
