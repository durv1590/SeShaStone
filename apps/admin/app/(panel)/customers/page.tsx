'use client';

import { useState } from 'react';
import { api, Paginated } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate, Pager } from '@/components/ui';

interface CustomerRow {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const params = new URLSearchParams({ page: String(page), ...(q && { q }) });
  const { data, error, reload } = useApi<Paginated<CustomerRow>>(`/admin/customers?${params}`);

  async function toggle(c: CustomerRow) {
    if (!confirm(`${c.isActive ? 'Block' : 'Unblock'} ${c.email}?`)) return;
    await api(`/admin/customers/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) });
    await reload();
  }

  return (
    <>
      <h1>Customers</h1>
      <div className="toolbar">
        <input className="input" placeholder="Name, email or phone" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Last login</th><th /></tr>
          </thead>
          <tbody>
            {data?.items.map((c) => (
              <tr key={c.id}>
                <td>{c.firstName} {c.lastName}</td>
                <td>{c.email}</td>
                <td>{c.phone ?? '—'}</td>
                <td><span className="badge">{c.role.toLowerCase()}</span></td>
                <td>{formatDate(c.createdAt)}</td>
                <td>{formatDate(c.lastLoginAt)}</td>
                <td>
                  <button className={`btn btn-sm ${c.isActive ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggle(c)}>
                    {c.isActive ? 'Block' : 'Unblock'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}
