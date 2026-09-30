import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { ProductGrid } from '@/components/product-card';
import { ProductGallery } from '@/components/product-gallery';
import { ProductPurchase } from '@/components/product-purchase';
import { Breadcrumbs, LuxuryHeading } from '@/components/ui';
import { api, ApiError, getSettings, Paginated, ProductDetail, ProductSummary, Review } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { lineByEnum } from '@/lib/lines';
import { absolute, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

async function getProduct(slug: string) {
  try {
    return await api<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return pageMetadata({
    title: p.seoTitle ?? p.name,
    description: p.seoDescription ?? p.description?.slice(0, 160) ?? `${p.name} — SeSha Stone`,
    path: `/product/${p.slug}`,
    image: p.images[0]?.url,
  });
}

/** Only verified attributes that have a value are listed — nothing is inferred or invented. */
function specifications(p: ProductDetail): [string, string][] {
  const rows: [string, string | null | undefined][] = [
    ['Jewellery line', lineByEnum(p.line)?.label],
    ['Category', p.category?.name],
    ['Metal', p.line === 'ARTIFICIAL' ? null : p.metal?.replace('_', ' ').toLowerCase()],
    ['Purity', p.line === 'ARTIFICIAL' ? null : p.purity],
    ['BIS hallmark (HUID)', p.hallmarkId],
    ['Finish', p.finish],
    ['Base material', p.baseMaterial],
    ['Plating', p.plating],
    ['Stone', p.stoneType ?? p.gemstone],
    ['Diamond weight', p.diamondCarat ? `${Number(p.diamondCarat)} ct` : null],
    ['Diamond cut', p.diamondCut],
    ['Diamond colour', p.diamondColour],
    ['Diamond clarity', p.diamondClarity],
    ['Certificate no.', p.certificateNumber],
    ['Dimensions', p.dimensions],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]);
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  const [reviews, related, settings] = await Promise.all([
    api<Paginated<Review>>(`/products/${product.id}/reviews?pageSize=10`).then((r) => r.items).catch(() => [] as Review[]),
    api<ProductSummary[]>(`/products/${encodeURIComponent(slug)}/related`).catch(() => [] as ProductSummary[]),
    getSettings(),
  ]);
  const line = lineByEnum(product.line);
  const specs = specifications(product);
  const prices = product.variants.map((v) => v.price);
  const freeAbove = settings['shipping.freeAbove'];
  const flat = settings['shipping.flatRate'];
  const windowDays = settings['returns.windowDays'];

  return (
    <>
      <Breadcrumbs
        items={[
          ...(line ? [{ name: line.label, path: line.path }] : []),
          // Only link subcategories that exist under this line (e.g. /gold/rings).
          ...(line && product.category && line.subcategories.some((s) => s.slug === product.category!.slug)
            ? [{ name: product.category.name, path: `${line.path}/${product.category.slug}` }]
            : []),
          { name: product.name, path: `/product/${product.slug}` },
        ]}
      />
      <div className="container pdp">
        <ProductGallery images={product.images} name={product.name} videoUrl={product.videoUrl} />
        <div className="pdp__info">
          <div>
            {line && <p className="eyebrow">{line.label}</p>}
            <h1 className="pdp__title">{product.name}</h1>
          </div>
          {product.rating.count > 0 && (
            <p style={{ margin: 0 }}>
              <span className="stars" aria-hidden="true">{'★'.repeat(Math.round(product.rating.average ?? 0))}</span>{' '}
              <a href="#reviews" className="muted">{product.rating.average?.toFixed(1)} · {product.rating.count} review{product.rating.count > 1 ? 's' : ''}</a>
            </p>
          )}
          {product.line === 'ARTIFICIAL' && (
            <p className="material-notice" style={{ margin: 0 }}>
              <strong>Premium artificial jewellery.</strong> This piece is fashion jewellery and is not made of gold, silver or diamond.
            </p>
          )}
          <div className="pdp__material">
            {specs.filter(([k]) => ['Metal', 'Purity', 'Stone', 'Plating', 'Diamond weight'].includes(k)).map(([k, v]) => (
              <span key={k} style={{ textTransform: 'capitalize' }}>{k}: {v}</span>
            ))}
            {product.isCertified && <span>Certified</span>}
          </div>
          <ProductPurchase product={product} />
          <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
            {freeAbove > 0 ? `Free delivery on orders above ${formatPrice(freeAbove)}.` : flat > 0 ? `Delivery ${formatPrice(flat)}.` : 'Free delivery.'}{' '}
            Delivery time is confirmed after your order is placed.
          </p>

          <div className="accordion">
            {product.description && (
              <details open>
                <summary>Description</summary>
                <div className="accordion__body">{product.description}</div>
              </details>
            )}
            {specs.length > 0 && (
              <details>
                <summary>Specifications</summary>
                <div className="accordion__body" style={{ whiteSpace: 'normal' }}>
                  <table className="specs">
                    <tbody>
                      {specs.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td style={{ textTransform: k === 'Metal' ? 'capitalize' : undefined }}>{v}</td></tr>)}
                      {product.variants[0]?.weightGrams && <tr><th scope="row">Gross weight</th><td>{Number(product.variants[0].weightGrams)} g</td></tr>}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            <details>
              <summary>Jewellery care</summary>
              <div className="accordion__body">
                {product.careInstructions ?? <>See our <Link className="link" href="/pages/jewellery-care">jewellery care guide</Link>.</>}
              </div>
            </details>
            <details>
              <summary>Shipping</summary>
              <div className="accordion__body">
                {product.shippingInfo ?? <>See our <Link className="link" href="/pages/shipping-policy">shipping policy</Link>.</>}
              </div>
            </details>
            <details>
              <summary>Returns</summary>
              <div className="accordion__body">
                {product.isReturnEligible
                  ? <>Eligible for return{windowDays > 0 ? ` within ${windowDays} days of delivery` : ''}. See our <Link className="link" href="/pages/return-policy">return policy</Link>.</>
                  : 'This piece is not eligible for return.'}
              </div>
            </details>
            {(product.isCertified || product.hallmarkId) && (
              <details>
                <summary>Authenticity</summary>
                <div className="accordion__body">
                  {product.hallmarkId && <>BIS hallmark HUID: {product.hallmarkId}{'\n'}</>}
                  {product.isCertified && product.certificateNumber && <>Certificate number: {product.certificateNumber}{'\n'}</>}
                  {product.certificateUrl && <a className="link" href={product.certificateUrl} target="_blank" rel="noopener noreferrer">View certificate</a>}
                </div>
              </details>
            )}
            <details>
              <summary>FAQs</summary>
              <div className="accordion__body">
                Questions about sizing, payment or delivery? Read our <Link className="link" href="/pages/faqs">FAQs</Link> or <Link className="link" href="/pages/contact">contact us</Link>.
              </div>
            </details>
          </div>
        </div>
      </div>

      <section id="reviews" className="section--tight container" aria-labelledby="reviews-title">
        <h2 id="reviews-title" style={{ marginBottom: 12 }}>Reviews</h2>
        {reviews.length ? (
          reviews.map((r) => (
            <div key={r.id} className="review">
              <p style={{ margin: 0 }}><span className="stars" aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> <strong>{r.title}</strong></p>
              {r.body && <p style={{ margin: '6px 0' }}>{r.body}</p>}
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>{r.customer.firstName} · verified purchase</p>
            </div>
          ))
        ) : (
          <p className="muted">No reviews yet. Reviews can be left by customers who have received this piece.</p>
        )}
      </section>

      {related.length > 0 && (
        <section className="section container">
          <LuxuryHeading eyebrow="You may also like" title="Related pieces" />
          <ProductGrid products={related} />
        </section>
      )}

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description ?? undefined,
          sku: product.variants[0]?.sku,
          image: product.images.map((i) => i.url),
          brand: { '@type': 'Brand', name: 'SeSha Stone' },
          category: line?.label,
          ...(product.line !== 'ARTIFICIAL' && product.metal && { material: product.metal.replace('_', ' ').toLowerCase() }),
          url: absolute(`/product/${product.slug}`),
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'INR',
            lowPrice: (Math.min(...prices) / 100).toFixed(2),
            highPrice: (Math.max(...prices) / 100).toFixed(2),
            offerCount: product.variants.length,
            availability: product.variants.some((v) => v.inStock) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
          // Ratings are included only when genuine approved reviews exist.
          ...(product.rating.count > 0 && {
            aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating.average, reviewCount: product.rating.count },
          }),
        }}
      />
    </>
  );
}
