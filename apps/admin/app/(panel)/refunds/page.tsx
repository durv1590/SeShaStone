'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDate, Pager, StatusBadge } from '@/components/ui';
import { api, Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface RefundRow {
  id: string;
  amount: number;
  reason: string;
  status: string;
  method: string | null;
  reference: string | null;
  processedAt: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string; status: string };
}

export default function RefundsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const { data, error, reload } = useApi<Paginated<RefundRow>>(`/admin/refunds?${params}`);
  const [actionError, setActionError] = useState<string | null>(null);

  async function update(id: string, next: 'PROCESSED' | 'FAILED') {
    const reference = next === 'PROCESSED' ? prompt('Refund transfer reference (UTR)') : undefined;
    if (next === 'PROCESSED' && !reference) return;
    try {
      await api(`/admin/refunds/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next, reference: reference ?? undefined }) });
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Refunds</h1>
      <p className="muted" style={{ marginTop: -12 }}>Refunds are created from the order page. Pay out from your bank or UPI, then mark them paid out with the transfer reference.</p>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Refund status">
          <option value="PENDING">Pending payout</option>
          <option value="PROCESSED">Paid out</option>
          <option value="FAILED">Failed</option>
          <option value="">All</option>
        </select>
      </div>
      {(error || actionError) && <p className="error">{error ?? actionError}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Created</th><th>Reason</th><th>Method</th><th>Reference</th><th>Status</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/orders/${r.order.id}`}>{r.order.orderNumber}</Link></td>
                <td>{formatDate(r.createdAt)}</td>
                <td style={{ whiteSpace: 'normal' }}>{r.reason}</td>
                <td>{r.method ?? '—'}</td>
                <td>{r.reference ?? '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td className="num">{formatPrice(r.amount)}</td>
                <td>{r.status === 'PENDING' && (
                  <span style={{ display: 'inline-flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => update(r.id, 'PROCESSED')}>Mark paid out</button>
                    <button className="btn btn-sm btn-danger" onClick={() => update(r.id, 'FAILED')}>Failed</button>
                  </span>
                )}</td>
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
