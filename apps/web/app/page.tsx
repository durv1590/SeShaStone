import Link from 'next/link';
import { BrandIcon, Monogram } from '@/components/brand';
import { ProductCard } from '@/components/product-card';
import { api, Banner, Paginated, ProductSummary } from '@/lib/api';
import { COLLECTIONS } from '@/lib/collections';

export default async function HomePage() {
  const [banners, featured, latest] = await Promise.all([
    api<Banner[]>('/banners?placement=HOME_HERO').catch(() => []),
    api<Paginated<ProductSummary>>('/products?featured=true&pageSize=8').catch(() => null),
    api<Paginated<ProductSummary>>('/products?pageSize=8').catch(() => null),
  ]);
  // A live CMS banner (Admin → CMS) replaces the default hero copy and adds its photo.
  const hero = banners[0];

  return (
    <>
      <section
        className="hero"
        style={hero ? { backgroundImage: `linear-gradient(90deg, rgba(27,27,27,.92) 35%, rgba(27,27,27,.45)), url(${hero.imageUrl})` } : undefined}
      >
        <div className="container hero-inner">
          <div className="hero-brand" aria-hidden="true">
            <Monogram size={120} />
            <span className="hero-legal">PVT. LTD.</span>
            <span className="hero-eyebrow">Timeless Elegance</span>
          </div>
          <div className="hero-copy">
            <p className="hero-eyebrow">Premium Jewellery for Every Celebration</p>
            <h1>{hero?.title ?? 'Where Every Stone Tells a Story'}</h1>
            {hero?.subtitle && <p className="hero-sub">{hero.subtitle}</p>}
            <div className="hero-actions">
              <Link href={hero?.linkUrl ?? '/products'} className="btn btn-gold">Explore the collection</Link>
              <Link href="/pages/about" className="btn btn-ghost-light">Our story</Link>
            </div>
          </div>
        </div>
        <div className="container collections">
          {COLLECTIONS.map((c) => (
            <Link key={c.key} href={c.href} className="collection">
              <BrandIcon name={c.key} size={34} />
              <span>{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {!!featured?.items.length && (
        <section className="section container">
          <p className="eyebrow">Handpicked</p>
          <h2 className="section-title">Featured pieces</h2>
          <div className="grid">
            {featured.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <section className="section container">
        <p className="eyebrow">Just in</p>
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
