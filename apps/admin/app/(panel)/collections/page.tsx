'use client';

import { FormEvent, useState } from 'react';
import { useSession } from '@/components/session';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  theme: string | null;
  rule: 'MANUAL' | 'NEWEST' | 'BESTSELLING';
  isActive: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  _count: { products: number };
}

const RULES = { MANUAL: 'Hand-picked products', NEWEST: 'Newest products (automatic)', BESTSELLING: 'Bestsellers (automatic)' };

export default function CollectionsPage() {
  const { can } = useSession();
  const { data, error, reload } = useApi<Collection[]>('/admin/collections');
  const [editing, setEditing] = useState<Partial<Collection> | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const editable = can('content.manage');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => (String(f.get(k) ?? '').trim() || undefined);
    const body = {
      name: text('name'),
      slug: text('slug'),
      heroTitle: text('heroTitle'),
      heroSubtitle: text('heroSubtitle'),
      heroImageUrl: text('heroImageUrl'),
      description: text('description'),
      theme: text('theme'),
      rule: f.get('rule'),
      sortOrder: Number(f.get('sortOrder') || 0),
      isActive: f.get('isActive') === 'on',
      seoTitle: text('seoTitle'),
      seoDescription: text('seoDescription'),
    };
    try {
      if (editing?.id) await api(`/admin/collections/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/collections', { method: 'POST', body: JSON.stringify(body) });
      setEditing(null);
      setFormError(null);
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  return (
    <>
      <div className="toolbar">
        <h1 style={{ margin: 0 }}>Collections</h1>
        <span className="grow" />
        {editable && <button className="btn" onClick={() => setEditing({ rule: 'MANUAL', isActive: true })}>New collection</button>}
      </div>
      <p className="muted">Assign products to hand-picked collections from each product’s edit page.</p>
      {error && <p className="error">{error}</p>}

      {editing && (
        <form className="panel form" onSubmit={save} key={editing.id ?? 'new'}>
          <h2>{editing.id ? `Edit ${editing.name}` : 'New collection'}</h2>
          <div className="form-grid">
            <label className="field">Name<input className="input" name="name" required defaultValue={editing.name ?? ''} /></label>
            <label className="field">URL slug<input className="input" name="slug" pattern="[a-z0-9-]+" defaultValue={editing.slug ?? ''} placeholder="auto from name" /></label>
            <label className="field">Products<select name="rule" defaultValue={editing.rule}>{Object.entries(RULES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="field">Theme<select name="theme" defaultValue={editing.theme ?? ''}><option value="">Ivory</option><option value="charcoal">Charcoal</option><option value="emerald">Emerald (festive / premium)</option><option value="burgundy">Burgundy (bridal / wedding)</option></select></label>
            <label className="field">Hero title<input className="input" name="heroTitle" defaultValue={editing.heroTitle ?? ''} /></label>
            <label className="field">Hero subtitle<input className="input" name="heroSubtitle" defaultValue={editing.heroSubtitle ?? ''} /></label>
            <label className="field">Hero image URL (1920×700)<input className="input" name="heroImageUrl" type="url" defaultValue={editing.heroImageUrl ?? ''} /></label>
            <label className="field">Sort order<input className="input" name="sortOrder" type="number" defaultValue={editing.sortOrder ?? 0} /></label>
            <label className="field">SEO title<input className="input" name="seoTitle" maxLength={70} defaultValue={editing.seoTitle ?? ''} /></label>
            <label className="field">SEO description<input className="input" name="seoDescription" maxLength={160} defaultValue={editing.seoDescription ?? ''} /></label>
          </div>
          <label className="field">Introduction / SEO copy<textarea name="description" defaultValue={editing.description ?? ''} /></label>
          <label className="check"><input type="checkbox" name="isActive" defaultChecked={editing.isActive} /> Visible on the website</label>
          {formError && <p className="error">{formError}</p>}
          <div className="toolbar"><button className="btn">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button></div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>URL</th><th>Products</th><th className="num">Assigned</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="muted">/collections/{c.slug}</td>
                <td>{RULES[c.rule]}</td>
                <td className="num">{c.rule === 'MANUAL' ? c._count.products : '—'}</td>
                <td>{c.isActive ? <span className="badge ok">Live</span> : <span className="badge">Hidden</span>}</td>
                <td>{editable && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
