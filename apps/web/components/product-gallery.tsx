'use client';

import { useState } from 'react';
import type { ProductImage } from '@/lib/api';
import { BrandMark } from './brand';

/** Main image with click-to-zoom, thumbnail rail and optional product video. */
export function ProductGallery({ images, name, videoUrl }: { images: ProductImage[]; name: string; videoUrl: string | null }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');
  const showVideo = videoUrl && index === images.length;
  const current = images[index];
  const hasThumbs = images.length > 1 || !!videoUrl;

  return (
    <div className={`gallery${hasThumbs ? '' : ' gallery--single'}`}>
      {hasThumbs && (
        <div className="gallery__thumbs" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              className="gallery__thumb"
              aria-current={i === index}
              aria-selected={i === index}
              aria-label={`Image ${i + 1} of ${images.length}`}
              onClick={() => { setIndex(i); setZoom(false); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" loading="lazy" />
            </button>
          ))}
          {videoUrl && (
            <button type="button" role="tab" className="gallery__thumb" aria-current={showVideo ? true : undefined} aria-label="Product video" onClick={() => setIndex(images.length)}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.1em' }}>VIDEO</span>
            </button>
          )}
        </div>
      )}
      {showVideo ? (
        <video className="gallery__video" src={videoUrl} controls playsInline preload="metadata" aria-label={`${name} video`} />
      ) : current ? (
        <button
          type="button"
          className={`gallery__main${zoom ? ' is-zoomed' : ''}`}
          aria-label={zoom ? 'Zoom out' : 'Zoom in'}
          onClick={() => setZoom((z) => !z)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt={current.alt ?? name} style={{ transformOrigin: origin }} fetchPriority="high" />
        </button>
      ) : (
        <div className="gallery__main" role="img" aria-label={`${name} — photo coming soon`}>
          <BrandMark size={140} />
        </div>
      )}
    </div>
  );
}
