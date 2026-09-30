'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export const METALS = ['GOLD', 'SILVER', 'PLATINUM', 'ROSE_GOLD', 'WHITE_GOLD', 'BRASS', 'OTHER'];

export interface ProductFields {
  name: string;
  slug?: string;
  description?: string | null;
  status: string;
  categoryId?: string | null;
  metal?: string | null;
  purity?: string | null;
  gemstone?: string | null;
  isCertified?: boolean;
  isFeatured?: boolean;
  tags?: string[];
  images?: { url: string; alt?: string | null }[];
}

interface Category {
  id: string;
  name: string;
}

/** Uploads a file straight to S3 via a presigned URL and returns its public URL. */
async function uploadImage(file: File) {
  const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>('/admin/uploads', {
    method: 'POST',
    body: JSON.stringify({ folder: 'products', filename: file.name, contentType: file.type }),
  });
  const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!res.ok) throw new Error('Image upload failed');
  return publicUrl;
}

export function ProductFieldsForm({
  initial,
  submitLabel,
  onSubmit,
  children,
}: {
  initial?: Partial<ProductFields>;
  submitLabel: string;
  onSubmit: (fields: ProductFields) => Promise<void>;
  children?: React.ReactNode;
}) {
  const categories = useApi<Category[]>('/admin/categories');
  const [images, setImages] = useState(initial?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => (f.get(k) as string)?.trim() || undefined;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: text('name')!,
        slug: text('slug'),
        description: text('description'),
        status: text('status') ?? 'DRAFT',
        categoryId: text('categoryId'),
        metal: text('metal'),
        purity: text('purity'),
        gemstone: text('gemstone'),
        isCertified: f.get('isCertified') === 'on',
        isFeatured: f.get('isFeatured') === 'on',
        tags: (text('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
        images: images.map(({ url, alt }) => ({ url, alt: alt ?? undefined })),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    try {
      for (const file of Array.from(files)) {
        const url = await uploadImage(file);
        setImages((prev) => [...prev, { url }]);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="panel form">
        <div className="form-grid">
          <label className="field">Name<input className="input" name="name" defaultValue={initial?.name} required /></label>
          <label className="field">Slug<input className="input" name="slug" defaultValue={initial?.slug} placeholder="auto from name" /></label>
          <label className="field">
            Status
            <select name="status" defaultValue={initial?.status ?? 'DRAFT'}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="field">
            Category
            <select name="categoryId" defaultValue={initial?.categoryId ?? ''}>
              <option value="">—</option>
              {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            Metal
            <select name="metal" defaultValue={initial?.metal ?? ''}>
              <option value="">—</option>
              {METALS.map((m) => <option key={m} value={m}>{m.replace('_', ' ').toLowerCase()}</option>)}
            </select>
          </label>
          <label className="field">Purity<input className="input" name="purity" defaultValue={initial?.purity ?? ''} placeholder="22K, 18K, 925" /></label>
          <label className="field">Gemstone<input className="input" name="gemstone" defaultValue={initial?.gemstone ?? ''} /></label>
          <label className="field">Tags<input className="input" name="tags" defaultValue={initial?.tags?.join(', ')} placeholder="comma separated" /></label>
        </div>
        <label className="field">Description<textarea name="description" defaultValue={initial?.description ?? ''} /></label>
        <div className="toolbar">
          <label className="check"><input type="checkbox" name="isCertified" defaultChecked={initial?.isCertified} /> Certified</label>
          <label className="check"><input type="checkbox" name="isFeatured" defaultChecked={initial?.isFeatured} /> Featured on home page</label>
        </div>
      </div>

      <div className="panel">
        <h2>Images</h2>
        <div className="toolbar">
          {images.map((img, i) => (
            <span key={img.url} className="badge">
              #{i + 1} {img.url.split('/').pop()}{' '}
              <button type="button" className="btn-sm btn btn-ghost" onClick={() => setImages(images.filter((x) => x !== img))}>×</button>
            </span>
          ))}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => onFiles(e.target.files)} />
      </div>

      {children}

      {error && <p className="error">{error}</p>}
      <div><button className="btn" disabled={busy}>{submitLabel}</button></div>
    </form>
  );
}
