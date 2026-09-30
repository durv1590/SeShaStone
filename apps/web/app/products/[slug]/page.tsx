import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Monogram } from '@/components/brand';
import { AddToCart } from '@/components/add-to-cart';
import { api, ApiError, ProductDetail } from '@/lib/api';

type Params = Promise<{ slug: string }>;

async function getProduct(slug: string) {
  try {
    return await api<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  return { title: product.name, description: product.description ?? undefined };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProduct((await params).slug);
  const image = product.images[0];

  return (
    <div className="container product">
      <div className="card-image" style={{ borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.alt ?? product.name} />
        ) : (
          <Monogram size={140} />
        )}
      </div>
      <div>
        {product.category && <p className="muted">{product.category.name}</p>}
        <h1>{product.name}</h1>
        {product.rating.count > 0 && (
          <p className="muted">
            ★ {product.rating.average?.toFixed(1)} · {product.rating.count} review{product.rating.count > 1 ? 's' : ''}
          </p>
        )}
        <p className="muted">
          {[product.purity, product.metal?.replace('_', ' ').toLowerCase(), product.gemstone]
            .filter(Boolean)
            .join(' · ')}
          {product.isCertified && ' · Certified'}
        </p>
        <AddToCart product={product} />
        {product.description && <p style={{ lineHeight: 1.7 }}>{product.description}</p>}
      </div>
    </div>
  );
}
