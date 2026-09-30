'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProductDetail } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';
import { WishlistButton } from './wishlist-button';

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const { addToCart } = useStore();
  const router = useRouter();
  const firstAvailable = product.variants.find((v) => v.inStock) ?? product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const variant = product.variants.find((v) => v.id === variantId);

  if (!variant) return <p className="muted">This piece is currently unavailable.</p>;
  const off = variant.compareAtPrice && variant.compareAtPrice > variant.price
    ? Math.round((1 - variant.price / variant.compareAtPrice) * 100)
    : 0;

  function add() {
    addToCart({
      variantId: variant!.id,
      productName: product.name,
      variantTitle: variant!.title,
      slug: product.slug,
      imageUrl: product.images[0]?.url,
      price: variant!.price,
      quantity: qty,
    });
  }

  return (
    <div className="stack">
      <div>
        <p className="price pdp__price" style={{ margin: 0 }}>
          {formatPrice(variant.price)}
          {off > 0 && (
            <>
              <s aria-label={`MRP ${formatPrice(variant.compareAtPrice!)}`}>{formatPrice(variant.compareAtPrice!)}</s>
              <span className="price__off">{off}% off</span>
            </>
          )}
        </p>
        <p className="muted" style={{ fontSize: '0.78rem', margin: '4px 0 0' }}>Inclusive of all taxes</p>
      </div>

      {product.variants.length > 1 && (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="eyebrow" style={{ marginBottom: 10 }}>Choose {product.variants.some((v) => v.size) ? 'size' : 'option'}</legend>
          <div className="chips">
            {product.variants.map((v) => (
              <button key={v.id} type="button" className="chip" aria-pressed={v.id === variantId} disabled={!v.inStock} onClick={() => { setVariantId(v.id); setAdded(false); }}>
                {v.title}{!v.inStock && <span className="sr-only"> (out of stock)</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {(variant.weightGrams || variant.netWeightGrams) && (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {variant.weightGrams && <>Gross weight {Number(variant.weightGrams)} g</>}
          {variant.weightGrams && variant.netWeightGrams && ' · '}
          {variant.netWeightGrams && <>Net weight {Number(variant.netWeightGrams)} g</>}
        </p>
      )}

      <div className="pdp__actions">
        <div className="qty" role="group" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(10, q + 1))}>+</button>
        </div>
        <button type="button" className="btn btn--outline" disabled={!variant.inStock} onClick={() => { add(); setAdded(true); }}>
          {variant.inStock ? (added ? 'Added ✓' : 'Add to Bag') : 'Out of stock'}
        </button>
        <button type="button" className="btn" disabled={!variant.inStock} onClick={() => { add(); router.push('/checkout'); }}>
          Buy Now
        </button>
        <WishlistButton productId={product.id} name={product.name} />
      </div>
      {added && <p className="notice notice--success" role="status" style={{ margin: 0 }}>Added to your bag. <Link className="link" href="/cart">View bag</Link></p>}
    </div>
  );
}
