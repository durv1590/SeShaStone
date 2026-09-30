'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export const METALS = ['GOLD', 'SILVER', 'PLATINUM', 'ROSE_GOLD', 'WHITE_GOLD', 'BRASS', 'OTHER'];
export const LINES: [string, string][] = [
  ['GOLD', 'Gold Jewellery'],
  ['SILVER', 'Silver Jewellery'],
  ['DIAMOND', 'Diamond Jewellery'],
  ['ARTIFICIAL', 'Premium Artificial Jewellery'],
];

export interface ProductFields {
  name: string;
  slug?: string;
  description?: string | null;
  status: string;
  line?: string | null;
  categoryId?: string | null;
  metal?: string | null;
  purity?: string | null;
  gemstone?: string | null;
  isCertified?: boolean;
  certificateUrl?: string | null;
  certificateNumber?: string | null;
  isFeatured?: boolean;
  tags?: string[];
  hallmarkId?: string | null;
  finish?: string | null;
  baseMaterial?: string | null;
  plating?: string | null;
  stoneType?: string | null;
  diamondCarat?: number | string | null;
  diamondCut?: string | null;
  diamondColour?: string | null;
  diamondClarity?: string | null;
  dimensions?: string | null;
  careInstructions?: string | null;
  shippingInfo?: string | null;
  isReturnEligible?: boolean;
  videoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  collectionIds?: string[];
  collections?: { id: string }[];
  images?: { url: string; alt?: string | null }[];
}

interface Option {
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

/**
 * Product editor. Line-specific attribute fields appear for the chosen jewellery line.
 * Only enter verified information — every filled field is shown to customers.
 */
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
  const categories = useApi<Option[]>('/admin/categories');
  const collections = useApi<(Option & { rule: string })[]>('/admin/collections');
  const [images, setImages] = useState(initial?.images ?? []);
  const [line, setLine] = useState(initial?.line ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initialCollections = new Set((initial?.collections ?? []).map((c) => c.id));

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => (f.get(k) as string | null)?.trim() || undefined;
    // Send null for cleared optional text fields on edit so values can be removed.
    const opt = (k: string) => text(k) ?? (initial ? null : undefined);
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: text('name')!,
        slug: text('slug'),
        description: opt('description'),
        status: text('status') ?? 'DRAFT',
        line: text('line'),
        categoryId: text('categoryId'),
        metal: line === 'ARTIFICIAL' ? text('metal') ?? 'OTHER' : text('metal'),
        purity: opt('purity'),
        gemstone: opt('gemstone'),
        isCertified: f.get('isCertified') === 'on',
        certificateUrl: opt('certificateUrl'),
        certificateNumber: opt('certificateNumber'),
        isFeatured: f.get('isFeatured') === 'on',
        tags: (text('tags') ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        hallmarkId: opt('hallmarkId'),
        finish: opt('finish'),
        baseMaterial: opt('baseMaterial'),
        plating: opt('plating'),
        stoneType: opt('stoneType'),
        diamondCarat: text('diamondCarat') ? Number(text('diamondCarat')) : initial ? null : undefined,
        diamondCut: opt('diamondCut'),
        diamondColour: opt('diamondColour'),
        diamondClarity: opt('diamondClarity'),
        dimensions: opt('dimensions'),
        careInstructions: opt('careInstructions'),
        shippingInfo: opt('shippingInfo'),
        isReturnEligible: f.get('isReturnEligible') === 'on',
        videoUrl: opt('videoUrl'),
        seoTitle: opt('seoTitle'),
        seoDescription: opt('seoDescription'),
        collectionIds: f.getAll('collectionIds') as string[],
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

  const s = (k: keyof ProductFields) => (initial?.[k] as string | null | undefined) ?? '';

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="panel form">
        <h2>Basics</h2>
        <div className="form-grid">
          <label className="field">Name<input className="input" name="name" defaultValue={initial?.name} required /></label>
          <label className="field">URL slug<input className="input" name="slug" defaultValue={initial?.slug} placeholder="auto from name" /></label>
          <label className="field">
            Jewellery line (required to publish)
            <select name="line" value={line} onChange={(e) => setLine(e.target.value)}>
              <option value="">— choose —</option>
              {LINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={initial?.status ?? 'DRAFT'}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active (live)</option>
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
          <label className="field">Occasion / style tags<input className="input" name="tags" defaultValue={initial?.tags?.join(', ')} placeholder="bridal, festive, everyday" /></label>
        </div>
        <label className="field">Description<textarea name="description" defaultValue={s('description')} /></label>
        {line === 'ARTIFICIAL' && (
          <p className="notice" style={{ margin: 0 }}>Premium artificial jewellery is always labelled as such on the website and never shown with gold, silver or diamond claims.</p>
        )}
      </div>

      <div className="panel form">
        <h2>Material &amp; stones <small className="muted" style={{ fontWeight: 400, fontSize: '0.8rem' }}>(verified details only)</small></h2>
        <div className="form-grid">
          {line !== 'ARTIFICIAL' && (
            <>
              <label className="field">
                Metal
                <select name="metal" defaultValue={initial?.metal ?? ''}>
                  <option value="">—</option>
                  {METALS.filter((m) => m !== 'BRASS' && m !== 'OTHER').map((m) => <option key={m} value={m}>{m.replace('_', ' ').toLowerCase()}</option>)}
                </select>
              </label>
              <label className="field">Purity<input className="input" name="purity" defaultValue={s('purity')} placeholder={line === 'SILVER' ? '925' : '22K, 18K, 14K'} /></label>
            </>
          )}
          {line === 'GOLD' && <label className="field">BIS hallmark HUID<input className="input" name="hallmarkId" defaultValue={s('hallmarkId')} maxLength={20} /></label>}
          {line === 'SILVER' && <label className="field">Finish<input className="input" name="finish" defaultValue={s('finish')} placeholder="oxidised, rhodium, matte" /></label>}
          {line === 'ARTIFICIAL' && (
            <>
              <label className="field">Base material<input className="input" name="baseMaterial" defaultValue={s('baseMaterial')} placeholder="brass, copper alloy" /></label>
              <label className="field">Plating<input className="input" name="plating" defaultValue={s('plating')} placeholder="gold-plated, rhodium-plated" /></label>
              <label className="field">Stone type<input className="input" name="stoneType" defaultValue={s('stoneType')} placeholder="kundan, CZ, pearl" /></label>
            </>
          )}
          {line !== 'ARTIFICIAL' && <label className="field">Gemstone<input className="input" name="gemstone" defaultValue={s('gemstone')} placeholder="Diamond, Ruby, Emerald" /></label>}
          {line === 'DIAMOND' && (
            <>
              <label className="field">Diamond weight (ct)<input className="input" name="diamondCarat" type="number" step="0.001" min="0" defaultValue={s('diamondCarat')} /></label>
              <label className="field">Cut<input className="input" name="diamondCut" defaultValue={s('diamondCut')} /></label>
              <label className="field">Colour<input className="input" name="diamondColour" defaultValue={s('diamondColour')} placeholder="E, F, G…" /></label>
              <label className="field">Clarity<input className="input" name="diamondClarity" defaultValue={s('diamondClarity')} placeholder="VVS1, VS2…" /></label>
            </>
          )}
          <label className="field">Dimensions<input className="input" name="dimensions" defaultValue={s('dimensions')} /></label>
          <label className="field">Certificate number<input className="input" name="certificateNumber" defaultValue={s('certificateNumber')} /></label>
          <label className="field">Certificate URL<input className="input" name="certificateUrl" type="url" defaultValue={s('certificateUrl')} /></label>
        </div>
        <div className="toolbar">
          <label className="check"><input type="checkbox" name="isCertified" defaultChecked={initial?.isCertified} /> Certified (only if a certificate exists)</label>
          <label className="check"><input type="checkbox" name="isFeatured" defaultChecked={initial?.isFeatured} /> Featured</label>
          <label className="check"><input type="checkbox" name="isReturnEligible" defaultChecked={initial?.isReturnEligible ?? true} /> Eligible for return</label>
        </div>
      </div>

      <div className="panel form">
        <h2>Care, shipping &amp; SEO</h2>
        <div className="form-grid">
          <label className="field">Care instructions<textarea name="careInstructions" rows={3} defaultValue={s('careInstructions')} placeholder="Leave empty to link to the general care guide" /></label>
          <label className="field">Shipping information<textarea name="shippingInfo" rows={3} defaultValue={s('shippingInfo')} placeholder="Leave empty to link to the shipping policy" /></label>
          <label className="field">SEO title<input className="input" name="seoTitle" maxLength={70} defaultValue={s('seoTitle')} /></label>
          <label className="field">SEO description<input className="input" name="seoDescription" maxLength={160} defaultValue={s('seoDescription')} /></label>
          <label className="field">Product video URL<input className="input" name="videoUrl" type="url" defaultValue={s('videoUrl')} /></label>
        </div>
        {!!collections.data?.length && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="muted" style={{ marginBottom: 6 }}>Hand-picked collections</legend>
            <div className="toolbar">
              {collections.data.filter((c) => c.rule === 'MANUAL').map((c) => (
                <label key={c.id} className="check"><input type="checkbox" name="collectionIds" value={c.id} defaultChecked={initialCollections.has(c.id)} /> {c.name}</label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="panel">
        <h2>Images</h2>
        <p className="muted">Use real photographs of this exact piece. Multiple images are supported; the first is the main image.</p>
        <div className="toolbar">
          {images.map((img, i) => (
            <span key={img.url} className="badge">
              #{i + 1} {img.url.split('/').pop()}{' '}
              <button type="button" className="btn-sm btn btn-ghost" aria-label={`Remove image ${i + 1}`} onClick={() => setImages(images.filter((x) => x !== img))}>×</button>
            </span>
          ))}
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(e) => onFiles(e.target.files)} aria-label="Upload product images" />
      </div>

      {children}

      {error && <p className="error" role="alert">{error}</p>}
      <div><button className="btn" disabled={busy}>{submitLabel}</button></div>
    </form>
  );
}
