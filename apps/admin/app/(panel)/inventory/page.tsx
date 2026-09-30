'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, Paginated } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Pager } from '@/components/ui';

interface InventoryRow {
  id: string;
  variantId: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  variant: { sku: string; title: string; product: { name: string } };
}

function Inventory() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [lowStock, setLowStock] = useState(useSearchParams().get('lowStock') === 'true');
  const params = new URLSearchParams({ page: String(page), ...(q && { q }), ...(lowStock && { lowStock: 'true' }) });
  const { data, error, reload } = useApi<Paginated<InventoryRow>>(`/admin/inventory?${params}`);
  const [actionError, setActionError] = useState<string | null>(null);

  async function adjust(row: InventoryRow) {
    const input = prompt(`Adjust stock for ${row.variant.sku} (e.g. 5 to add, -1 to remove)`);
    const delta = Number(input);
    if (!input || !Number.isInteger(delta) || delta === 0) return;
    const reason = prompt('Reason (optional)') ?? undefined;
    try {
      await api(`/admin/inventory/${row.variantId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ delta, type: delta > 0 ? 'RESTOCK' : 'ADJUSTMENT', reason }),
      });
      setActionError(null);
      await reload();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Inventory</h1>
      <div className="toolbar">
        <input className="input" placeholder="SKU or product" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <label className="check">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} /> Low stock only
        </label>
      </div>
      {(error || actionError) && <p className="error">{error ?? actionError}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Product</th><th>SKU</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Available</th><th className="num">Alert at</th><th /></tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.id}>
                <td>{row.variant.product.name} <span className="muted">· {row.variant.title}</span></td>
                <td>{row.variant.sku}</td>
                <td className="num">{row.quantity}</td>
                <td className="num">{row.reserved}</td>
                <td className="num">
                  <span className={`badge ${row.available <= row.lowStockThreshold ? 'bad' : 'ok'}`}>{row.available}</span>
                </td>
                <td className="num">{row.lowStockThreshold}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => adjust(row)}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} />}
    </>
  );
}

export default function InventoryPage() {
  return (
    <Suspense>
      <Inventory />
    </Suspense>
  );
}
