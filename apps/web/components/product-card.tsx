import Link from 'next/link';
import { ProductSummary } from '@/lib/api';
import { formatPrice } from '@/lib/format';

export function ProductCard({ product }: { product: ProductSummary }) {
  const image = product.images[0];
  const compareAt = product.variants[0]?.compareAtPrice;
  return (
    <Link href={`/products/${product.slug}`} className="card">
      <div className="card-image">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt ?? product.name} loading="lazy" />
        ) : (
          <span>Se Sha Stone</span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{product.name}</h3>
        <p className="card-meta">
          {[product.purity, product.metal?.replace('_', ' ').toLowerCase(), product.gemstone]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <span className="price">
          {product.minPrice !== product.maxPrice && 'From '}
          {formatPrice(product.minPrice)}
          {compareAt && compareAt > product.minPrice && <s>{formatPrice(compareAt)}</s>}
        </span>
      </div>
    </Link>
  );
}
