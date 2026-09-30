'use client';

import { useState } from 'react';
import { api, Paginated } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate, Pager, StatusBadge } from '@/components/ui';

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: string;
  customer: { email: string };
  product: { name: string };
}

export default function ReviewsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING');
  const params = new URLSearchParams({ page: String(page), ...(status && { status }) });
  const { data, error, reload } = useApi<Paginated<ReviewRow>>(`/admin/reviews?${params}`);

  async function moderate(id: string, next: 'APPROVED' | 'REJECTED') {
    await api(`/admin/reviews/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    await reload();
  }

  return (
    <>
      <h1>Reviews</h1>
      <div className="toolbar">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="PENDING">Awaiting moderation</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {data?.items.length === 0 && <p className="muted">Nothing here.</p>}
      {data?.items.map((r) => (
        <div key={r.id} className="panel">
          <div className="toolbar">
            <strong>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</strong>
            <span>{r.product.name}</span>
            <StatusBadge status={r.status} />
            <span className="grow" />
            <span className="muted">{r.customer.email} · {formatDate(r.createdAt)}</span>
          </div>
          {r.title && <p><strong>{r.title}</strong></p>}
          {r.body && <p>{r.body}</p>}
          {r.status !== 'APPROVED' && <button className="btn btn-sm" onClick={() => moderate(r.id, 'APPROVED')}>Approve</button>}{' '}
          {r.status !== 'REJECTED' && <button className="btn btn-sm btn-danger" onClick={() => moderate(r.id, 'REJECTED')}>Reject</button>}
        </div>
      ))}
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
