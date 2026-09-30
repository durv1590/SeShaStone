'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, Paginated } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { Pager, StatusBadge } from '@/components/ui';

interface ProductRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  minPrice: number;
  maxPrice: number;
  category: { name: string } | null;
  variants: unknown[];
}

export default function ProductsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const params = new URLSearchParams({ page: String(page), ...(q && { q }), ...(status && { status }) });
  const { data, error } = useApi<Paginated<ProductRow>>(`/admin/products?${params}`);

  async function reindex() {
    const res = await api<{ indexed: number }>('/admin/products/reindex', { method: 'POST' });
    setNotice(`Search index rebuilt — ${res.indexed} products indexed.`);
  }

  return (
    <>
      <h1>Products</h1>
      <div className="toolbar">
        <input className="input" placeholder="Name or SKU" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <span className="grow" />
        <button className="btn btn-ghost" onClick={reindex}>Rebuild search index</button>
        <Link className="btn" href="/products/new">New product</Link>
      </div>
      {notice && <p className="muted">{notice}</p>}
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Category</th><th className="num">Variants</th><th>Status</th><th className="num">Price</th></tr>
          </thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.category?.name ?? '—'}</td>
                <td className="num">{p.variants.length}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="num">
                  {formatPrice(p.minPrice)}
                  {p.maxPrice !== p.minPrice && ` – ${formatPrice(p.maxPrice)}`}
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
