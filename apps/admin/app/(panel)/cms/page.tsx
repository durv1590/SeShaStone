'use client';

import { FormEvent, useState } from 'react';
import { formatDate } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  tabletImageUrl: string | null;
  mobileImageUrl: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  theme: string | null;
  placement: string;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

const PLACEMENTS: Record<string, string> = { HOME_HERO: 'Home hero', HOME_STRIP: 'Home campaign strip', CATEGORY: 'Category', POPUP: 'Popup' };
const THEMES = ['', 'ivory', 'charcoal', 'emerald', 'burgundy', 'gold', 'silver', 'festive', 'diwali', 'bridal'];
const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

function campaignState(b: Banner) {
  const now = Date.now();
  if (!b.isActive) return ['Hidden', ''];
  if (b.startsAt && new Date(b.startsAt).getTime() > now) return ['Scheduled', 'warn'];
  if (b.endsAt && new Date(b.endsAt).getTime() < now) return ['Ended', 'bad'];
  return ['Live', 'ok'];
}

export default function CmsPage() {
  const pages = useApi<Page[]>('/admin/pages');
  const banners = useApi<Banner[]>('/admin/banners');
  const [editingPage, setEditingPage] = useState<Partial<Page> | null>(null);
  const [editingBanner, setEditingBanner] = useState<Partial<Banner> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function savePage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      slug: f.get('slug'),
      title: f.get('title'),
      content: f.get('content'),
      isPublished: f.get('isPublished') === 'on',
      seoTitle: f.get('seoTitle') || undefined,
      seoDescription: f.get('seoDescription') || undefined,
    };
    try {
      if (editingPage?.id) await api(`/admin/pages/${editingPage.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/pages', { method: 'POST', body: JSON.stringify(body) });
      setEditingPage(null);
      setError(null);
      await pages.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function saveBanner(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => (String(f.get(k) ?? '').trim() || undefined);
    const date = (k: string) => (text(k) ? new Date(text(k)!).toISOString() : undefined);
    const body = {
      title: text('title'),
      subtitle: text('subtitle'),
      imageUrl: text('imageUrl'),
      tabletImageUrl: text('tabletImageUrl'),
      mobileImageUrl: text('mobileImageUrl'),
      ctaLabel: text('ctaLabel'),
      linkUrl: text('linkUrl'),
      theme: text('theme'),
      placement: f.get('placement'),
      sortOrder: Number(f.get('sortOrder') || 0),
      isActive: f.get('isActive') === 'on',
      startsAt: date('startsAt'),
      endsAt: date('endsAt'),
    };
    try {
      if (editingBanner?.id) await api(`/admin/banners/${editingBanner.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await api('/admin/banners', { method: 'POST', body: JSON.stringify(body) });
      setEditingBanner(null);
      setError(null);
      await banners.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeBanner(b: Banner) {
    if (!confirm(`Delete campaign “${b.title}”?`)) return;
    await api(`/admin/banners/${b.id}`, { method: 'DELETE' });
    await banners.reload();
  }

  return (
    <>
      <h1>Banners &amp; CMS</h1>
      {error && <p className="notice bad" role="alert">{error}</p>}

      <div className="panel">
        <div className="section-title">
          <h2>Campaign banners</h2>
          <button className="btn btn-sm" onClick={() => setEditingBanner({ placement: 'HOME_HERO', isActive: true, sortOrder: 0 })}>New campaign</button>
        </div>
        <p className="muted">Sizes: desktop 1920×700, tablet 1280×700, mobile 1080×1350. Upload images via Products → image upload or your CDN, then paste the URLs. Schedule with start/end dates.</p>

        {editingBanner && (
          <form className="form panel" onSubmit={saveBanner} key={editingBanner.id ?? 'new'} style={{ background: '#fbf9f4' }}>
            <h3>{editingBanner.id ? 'Edit campaign' : 'New campaign'}</h3>
            <div className="form-grid">
              <label className="field">Title<input className="input" name="title" required maxLength={120} defaultValue={editingBanner.title ?? ''} /></label>
              <label className="field">Subtitle<input className="input" name="subtitle" maxLength={200} defaultValue={editingBanner.subtitle ?? ''} /></label>
              <label className="field">Desktop image URL (1920×700)<input className="input" name="imageUrl" type="url" required defaultValue={editingBanner.imageUrl ?? ''} /></label>
              <label className="field">Tablet image URL (1280×700)<input className="input" name="tabletImageUrl" type="url" defaultValue={editingBanner.tabletImageUrl ?? ''} /></label>
              <label className="field">Mobile image URL (1080×1350)<input className="input" name="mobileImageUrl" type="url" defaultValue={editingBanner.mobileImageUrl ?? ''} /></label>
              <label className="field">Button label<input className="input" name="ctaLabel" maxLength={40} defaultValue={editingBanner.ctaLabel ?? ''} placeholder="Explore Collection" /></label>
              <label className="field">Link (site path or https URL)<input className="input" name="linkUrl" defaultValue={editingBanner.linkUrl ?? ''} placeholder="/collections/bridal" /></label>
              <label className="field">Placement<select name="placement" defaultValue={editingBanner.placement}>{Object.entries(PLACEMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="field">Theme<select name="theme" defaultValue={editingBanner.theme ?? ''}>{THEMES.map((t) => <option key={t} value={t}>{t || 'Default'}</option>)}</select></label>
              <label className="field">Display priority (lower first)<input className="input" name="sortOrder" type="number" defaultValue={editingBanner.sortOrder ?? 0} /></label>
              <label className="field">Starts<input className="input" name="startsAt" type="datetime-local" defaultValue={toLocal(editingBanner.startsAt ?? null)} /></label>
              <label className="field">Ends<input className="input" name="endsAt" type="datetime-local" defaultValue={toLocal(editingBanner.endsAt ?? null)} /></label>
            </div>
            <label className="check"><input type="checkbox" name="isActive" defaultChecked={editingBanner.isActive} /> Active</label>
            {editingBanner.imageUrl && (
              <div className="toolbar" aria-label="Preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editingBanner.imageUrl} alt="Desktop preview" style={{ height: 90, borderRadius: 4 }} />
                {editingBanner.mobileImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editingBanner.mobileImageUrl} alt="Mobile preview" style={{ height: 110, borderRadius: 4 }} />
                )}
              </div>
            )}
            <div className="toolbar">
              <button className="btn">Save campaign</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditingBanner(null)}>Cancel</button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Placement</th><th>Link</th><th>Schedule</th><th className="num">Priority</th><th>Status</th><th /></tr></thead>
            <tbody>
              {banners.data?.map((b) => {
                const [label, tone] = campaignState(b);
                return (
                  <tr key={b.id}>
                    <td>{b.title}{b.theme && <span className="muted"> · {b.theme}</span>}</td>
                    <td>{PLACEMENTS[b.placement] ?? b.placement}</td>
                    <td className="muted">{b.linkUrl ?? '—'}</td>
                    <td className="muted">{b.startsAt || b.endsAt ? `${formatDate(b.startsAt)} → ${formatDate(b.endsAt)}` : 'Always'}</td>
                    <td className="num">{b.sortOrder}</td>
                    <td><span className={`badge ${tone}`}>{label}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingBanner(b)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => removeBanner(b)}>Delete</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
              {banners.data?.length === 0 && <tr><td colSpan={7} className="muted">No campaigns yet — the homepage shows the brand hero.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-title">
          <h2>Pages &amp; policies</h2>
          <button className="btn btn-sm" onClick={() => setEditingPage({ isPublished: false })}>New page</button>
        </div>
        <p className="muted">Edit a policy page here whenever the policy changes. A page whose text starts with “DRAFT —” shows a draft banner and is hidden from search engines.</p>
        {editingPage && (
          <form className="form panel" onSubmit={savePage} key={editingPage.id ?? 'new'} style={{ background: '#fbf9f4' }}>
            <div className="form-grid">
              <label className="field">URL slug<input className="input" name="slug" defaultValue={editingPage.slug ?? ''} pattern="[a-z0-9-]+" required /></label>
              <label className="field">Title<input className="input" name="title" defaultValue={editingPage.title ?? ''} required /></label>
              <label className="field">SEO title<input className="input" name="seoTitle" maxLength={70} defaultValue={editingPage.seoTitle ?? ''} /></label>
              <label className="field">SEO description<input className="input" name="seoDescription" maxLength={160} defaultValue={editingPage.seoDescription ?? ''} /></label>
            </div>
            <label className="field">Content <small className="muted">(blank line = new paragraph · start a paragraph with “## ” for a heading · start each line with “- ” for a list)</small><textarea name="content" rows={14} defaultValue={editingPage.content ?? ''} required /></label>
            <label className="check"><input type="checkbox" name="isPublished" defaultChecked={editingPage.isPublished} /> Published</label>
            <div className="toolbar">
              <button className="btn">Save page</button>
              {editingPage.slug && <a className="btn btn-ghost" href={`${process.env.NEXT_PUBLIC_STORE_URL ?? 'http://localhost:3000'}/pages/${editingPage.slug}`} target="_blank" rel="noopener noreferrer">Preview</a>}
              <button type="button" className="btn btn-ghost" onClick={() => setEditingPage(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Title</th><th>URL</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {pages.data?.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td className="muted">/pages/{p.slug}</td>
                  <td>
                    {!p.isPublished ? <span className="badge">Unpublished</span> : p.content.startsWith('DRAFT —') ? <span className="badge warn">Draft text</span> : <span className="badge ok">Published</span>}
                  </td>
                  <td>{formatDate(p.updatedAt)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setEditingPage(p)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
