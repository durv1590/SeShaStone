'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/components/ui';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  placement: string;
  isActive: boolean;
}

export default function CmsPage() {
  const pages = useApi<Page[]>('/admin/pages');
  const banners = useApi<Banner[]>('/admin/banners');
  const [editing, setEditing] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function savePage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      slug: f.get('slug'),
      title: f.get('title'),
      content: f.get('content'),
      isPublished: f.get('isPublished') === 'on',
    };
    try {
      if (editing?.id) await api(`/admin/pages/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/pages', { method: 'POST', body: JSON.stringify(body) });
      setEditing(null);
      setError(null);
      await pages.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function createBanner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api('/admin/banners', {
        method: 'POST',
        body: JSON.stringify({ ...f, subtitle: f.subtitle || undefined, linkUrl: f.linkUrl || undefined }),
      });
      form.reset();
      setError(null);
      await banners.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleBanner(b: Banner) {
    await api(`/admin/banners/${b.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !b.isActive }) });
    await banners.reload();
  }

  return (
    <>
      <h1>Content</h1>
      {error && <p className="error">{error}</p>}

      <div className="panel">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Pages</h2>
          <span className="grow" />
          <button className="btn btn-sm" onClick={() => setEditing({ id: '', slug: '', title: '', content: '', isPublished: false, updatedAt: '' })}>
            New page
          </button>
        </div>
        {editing && (
          <form className="form" onSubmit={savePage} key={editing.id || 'new'}>
            <div className="form-grid">
              <label className="field">Slug<input className="input" name="slug" defaultValue={editing.slug} pattern="[a-z0-9-]+" required /></label>
              <label className="field">Title<input className="input" name="title" defaultValue={editing.title} required /></label>
            </div>
            <label className="field">Content<textarea name="content" defaultValue={editing.content} required /></label>
            <label className="check"><input type="checkbox" name="isPublished" defaultChecked={editing.isPublished} /> Published</label>
            <div className="toolbar">
              <button className="btn">Save page</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="table">
            <thead><tr><th>Title</th><th>URL</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {pages.data?.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td className="muted">/pages/{p.slug}</td>
                  <td>{p.isPublished ? 'Published' : 'Draft'}</td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>Banners</h2>
        <form className="form-grid" onSubmit={createBanner} style={{ marginBottom: 12 }}>
          <input className="input" name="title" placeholder="Headline" required />
          <input className="input" name="subtitle" placeholder="Subtitle" />
          <input className="input" name="imageUrl" placeholder="Image URL" type="url" required />
          <input className="input" name="linkUrl" placeholder="Link (e.g. /products?category=rings)" />
          <select name="placement" defaultValue="HOME_HERO">
            <option value="HOME_HERO">Home hero</option>
            <option value="HOME_STRIP">Home strip</option>
            <option value="CATEGORY">Category</option>
            <option value="POPUP">Popup</option>
          </select>
          <button className="btn">Add banner</button>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Headline</th><th>Placement</th><th>Link</th><th /></tr></thead>
            <tbody>
              {banners.data?.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td>{b.placement.replace('_', ' ').toLowerCase()}</td>
                  <td className="muted">{b.linkUrl ?? '—'}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => toggleBanner(b)}>{b.isActive ? 'Live' : 'Hidden'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
