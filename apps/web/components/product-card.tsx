import Link from 'next/link';
import type { ProductSummary } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { LINE_LABEL } from '@/lib/lines';
import { BrandMark } from './brand';
import { WishlistButton } from './wishlist-button';

/** JewelleryCard: image (second image on hover), line tag, name, verified material, price. */
export function ProductCard({ product, priority = false }: { product: ProductSummary; priority?: boolean }) {
  const [first, second] = product.images;
  const compareAt = product.variants.find((v) => v.price === product.minPrice)?.compareAtPrice;
  const meta = [product.purity, product.metal?.replace('_', ' ').toLowerCase(), product.gemstone].filter(Boolean).join(' · ');
  return (
    <article className="card">
      <Link href={`/product/${product.slug}`} className="card__media" aria-label={product.name}>
        {first ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={first.url} alt={first.alt ?? product.name} loading={priority ? 'eager' : 'lazy'} decoding="async" />
            {second && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={second.url} alt="" loading="lazy" decoding="async" aria-hidden="true" />
            )}
          </>
        ) : (
          <BrandMark size={64} />
        )}
        {product.line && (
          <span className={`card__tag${product.line === 'ARTIFICIAL' ? ' card__tag--artificial' : ''}`}>
            {LINE_LABEL[product.line]}
          </span>
        )}
      </Link>
      <WishlistButton productId={product.id} name={product.name} className="card__wish" />
      <div className="card__body">
        <h3 className="card__title"><Link href={`/product/${product.slug}`}>{product.name}</Link></h3>
        {meta && <p className="card__meta" style={{ margin: 0, textTransform: 'capitalize' }}>{meta}</p>}
        <p className="price" style={{ margin: 0 }}>
          {product.minPrice !== product.maxPrice && <span className="muted" style={{ fontWeight: 400 }}>From </span>}
          {formatPrice(product.minPrice)}
          {compareAt && compareAt > product.minPrice && <s>{formatPrice(compareAt)}</s>}
        </p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, columns = 4 }: { products: ProductSummary[]; columns?: 3 | 4 }) {
  return (
    <div className={`grid${columns === 3 ? ' grid--3' : ''}`}>
      {products.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 2} />)}
    </div>
  );
}
