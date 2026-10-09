'use client';

import { DragEvent, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatBytes, MIN_GOOD_EDGE, prepareImage } from '@/lib/image-prep';

export interface ManagedImage {
  url: string;
  alt?: string | null;
}

interface Pending {
  id: number;
  name: string;
  preview: string;
  status: string;
  failed?: boolean;
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Sends a prepared image to the storage the API chose (signed upload link) and returns its public URL. */
async function upload(folder: string, blob: Blob, type: string, baseName: string) {
  const filename = `${baseName.replace(/\.[^.]+$/, '') || 'photo'}.${EXT[type] ?? 'jpg'}`;
  const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>('/admin/uploads', {
    method: 'POST',
    body: JSON.stringify({ folder, filename, contentType: type }),
  });
  const res = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': type } });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return publicUrl;
}

/**
 * Product photo manager: photos are resized and converted in the browser before upload, can be
 * reordered by dragging (or with the arrow buttons) and each gets alt text. The first is the main image.
 */
export function ImageManager({
  images,
  onChange,
  folder = 'products',
}: {
  images: ManagedImage[];
  onChange: (images: ManagedImage[]) => void;
  folder?: string;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const nextId = useRef(0);
  const latest = useRef(images);
  latest.current = images;

  const update = (id: number, patch: Partial<Pending>) => setPending((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const items = files.map((f) => ({ id: nextId.current++, name: f.name, preview: URL.createObjectURL(f), status: 'Preparing…' }));
    setPending((p) => [...p, ...items]);
    setNotes([]);
    // Upload in parallel, but add to the gallery in the order the files were chosen.
    const results = await Promise.all(
      files.map(async (file, i) => {
        const item = items[i];
        try {
          const prepared = await prepareImage(file);
          update(item.id, { status: `Uploading ${formatBytes(prepared.blob.size)}…` });
          const url = await upload(folder, prepared.blob, prepared.type, file.name);
          const note = [
            prepared.blob !== file ? `${file.name}: ${formatBytes(prepared.originalBytes)} → ${formatBytes(prepared.blob.size)} (${prepared.width}×${prepared.height})` : null,
            prepared.lowResolution ? `${file.name}: only ${Math.min(prepared.width, prepared.height)}px on its short side — photos of at least ${MIN_GOOD_EDGE}px look sharper.` : null,
          ].filter((n): n is string => !!n);
          URL.revokeObjectURL(item.preview);
          setPending((p) => p.filter((x) => x.id !== item.id));
          return { url, note };
        } catch (err) {
          update(item.id, { status: (err as Error).message, failed: true });
          return null;
        }
      }),
    );
    const done = results.filter((r): r is { url: string; note: string[] } => !!r);
    if (done.length) onChange([...latest.current, ...done.map(({ url }) => ({ url, alt: '' }))]);
    setNotes(done.flatMap((r) => r.note));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  const onDropZone = (e: DragEvent) => {
    e.preventDefault();
    setDropOver(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div className="image-manager">
      {images.length > 0 && (
        <ol className="image-grid" aria-label="Product photos (the first is the main image)">
          {images.map((img, i) => (
            <li
              key={img.url}
              className={`image-tile${dragFrom === i ? ' is-dragging' : ''}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragEnd={() => setDragFrom(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
              }}
            >
              <div className="image-tile__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" />
                {i === 0 && <span className="badge ok image-tile__main">Main</span>}
              </div>
              <input
                className="input"
                value={img.alt ?? ''}
                maxLength={160}
                placeholder="Describe the photo (alt text)"
                aria-label={`Alt text for photo ${i + 1}`}
                onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="image-tile__actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`}>←</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`}>→</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {pending.length > 0 && (
        <ul className="image-grid" aria-label="Uploads in progress">
          {pending.map((p) => (
            <li key={p.id} className="image-tile is-pending">
              <div className="image-tile__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" />
              </div>
              <p className={p.failed ? 'error' : 'muted'} role="status">{p.status}</p>
              {p.failed && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>Dismiss</button>}
            </li>
          ))}
        </ul>
      )}

      <label
        className={`dropzone${dropOver ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDropOver(true);
        }}
        onDragLeave={() => setDropOver(false)}
        onDrop={onDropZone}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
          multiple
          className="sr-only"
          aria-label="Add product photos"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <strong>Add photos</strong> — drop them here or click to choose. They are resized to 2000px and compressed automatically.
      </label>
      {notes.length > 0 && (
        <ul className="muted image-notes">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}
