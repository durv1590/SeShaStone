import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { api, Banner, Paginated, ProductSummary } from '@/lib/api';

export default async function HomePage() {
  const [banners, featured, latest] = await Promise.all([
    api<Banner[]>('/banners?placement=HOME_HERO').catch(() => []),
    api<Paginated<ProductSummary>>('/products?featured=true&pageSize=8').catch(() => null),
    api<Paginated<ProductSummary>>('/products?pageSize=8').catch(() => null),
  ]);
  const hero = banners[0];

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{hero?.title ?? 'Jewellery, set in stone.'}</h1>
          <p>{hero?.subtitle ?? 'Hallmarked gold & silver, certified gemstones, crafted to be heirlooms.'}</p>
          <Link href={hero?.linkUrl ?? '/products'} className="btn">Explore the collection</Link>
        </div>
      </section>

      {!!featured?.items.length && (
        <section className="section container">
          <h2 className="section-title">Featured</h2>
          <div className="grid">
            {featured.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="section container">
        <h2 className="section-title">New arrivals</h2>
        {latest?.items.length ? (
          <div className="grid">
            {latest.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <p className="muted">New pieces are on their way.</p>
        )}
      </section>
    </>
  );
}
