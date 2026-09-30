'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDate, Pager } from '@/components/ui';
import { Paginated } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Row {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

const ACTIONS = ['', 'settings.', 'payment.', 'refund.', 'order.', 'product.', 'collection.', 'user.'];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '50', ...(action && { action }) });
  const { data, error } = useApi<Paginated<Row>>(`/admin/audit-logs?${params}`);

  return (
    <>
      <h1>Audit log</h1>
      <p className="muted" style={{ marginTop: -12 }}>Append-only record of administrative and financial actions. Sensitive values are masked.</p>
      <div className="toolbar">
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter by action">
          {ACTIONS.map((a) => <option key={a} value={a}>{a ? a.replace('.', '') : 'All actions'}</option>)}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td>{formatDate(r.createdAt)}</td>
                <td>{r.actorEmail ?? 'customer / system'}</td>
                <td>{r.action}</td>
                <td>{r.entityType === 'Order' && r.entityId ? <Link href={`/orders/${r.entityId}`}>Order</Link> : `${r.entityType}${r.entityId ? ` · ${r.entityId.slice(0, 40)}` : ''}`}</td>
                <td style={{ whiteSpace: 'normal', fontSize: '0.78rem', maxWidth: 420 }}>
                  {r.before != null && <div><span className="muted">before</span> {JSON.stringify(r.before)}</div>}
                  {r.after != null && <div><span className="muted">after</span> {JSON.stringify(r.after)}</div>}
                </td>
                <td className="muted">{r.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
