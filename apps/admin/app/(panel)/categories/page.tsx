'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  _count: { products: number };
}

export default function CategoriesPage() {
  const { data, error, reload } = useApi<Category[]>('/admin/categories');
  const [formError, setFormError] = useState<string | null>(null);
  const byId = new Map(data?.map((c) => [c.id, c]));

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: f.name, parentId: f.parentId || undefined, sortOrder: Number(f.sortOrder) || 0 }),
      });
      form.reset();
      setFormError(null);
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function toggle(c: Category) {
    await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) });
    await reload();
  }

  return (
    <>
      <h1>Categories</h1>
      <form className="panel toolbar" onSubmit={create}>
        <input className="input" name="name" placeholder="Category name" required />
        <select name="parentId" defaultValue="">
          <option value="">No parent</option>
          {data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" name="sortOrder" type="number" placeholder="Sort order" style={{ width: 110 }} />
        <button className="btn">Add category</button>
        {formError && <span className="error">{formError}</span>}
      </form>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Slug</th><th>Parent</th><th className="num">Products</th><th className="num">Sort</th><th>Visible</th></tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">{c.slug}</td>
                <td>{c.parentId ? byId.get(c.parentId)?.name : '—'}</td>
                <td className="num">{c._count.products}</td>
                <td className="num">{c.sortOrder}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.isActive ? 'Visible' : 'Hidden'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
