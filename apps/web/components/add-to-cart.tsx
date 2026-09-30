'use client';

import { useState } from 'react';
import { ProductDetail } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

export function AddToCart({ product }: { product: ProductDetail }) {
  const { addToCart } = useStore();
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);

  if (!variant) return <p className="muted">Currently unavailable.</p>;

  return (
    <div>
      <p className="price" style={{ fontSize: '1.5rem', margin: '16px 0 0' }}>
        {formatPrice(variant.price)}
        {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
          <s>{formatPrice(variant.compareAtPrice)}</s>
        )}
      </p>
      <p className="muted" style={{ fontSize: '0.85rem' }}>Inclusive of all taxes</p>

      {product.variants.length > 1 && (
        <div className="variants">
          {product.variants.map((v) => (
            <button
              key={v.id}
              className="chip"
              aria-pressed={v.id === variantId}
              disabled={!v.inStock}
              onClick={() => setVariantId(v.id)}
            >
              {v.title}
            </button>
          ))}
        </div>
      )}

      <button
        className="btn"
        disabled={!variant.inStock}
        style={{ margin: '8px 0 24px' }}
        onClick={() => {
          addToCart({
            variantId: variant.id,
            productName: product.name,
            variantTitle: variant.title,
            slug: product.slug,
            imageUrl: product.images[0]?.url,
            price: variant.price,
            quantity: 1,
          });
          setAdded(true);
        }}
      >
        {variant.inStock ? (added ? 'Added to bag ✓' : 'Add to bag') : 'Out of stock'}
      </button>
    </div>
  );
}
