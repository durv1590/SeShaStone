import Link from 'next/link';
import { BrandMark, Icon } from '@/components/brand';
import { CampaignBanner } from '@/components/campaign-banner';
import { NewsletterForm } from '@/components/newsletter-form';
import { ProductGrid } from '@/components/product-card';
import { LuxuryHeading } from '@/components/ui';
import { api, Banner, Paginated, ProductSummary } from '@/lib/api';
import { LINES } from '@/lib/lines';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'SeSha Stone — Timeless Elegance | Premium Jewellery', path: '/' });

const products = (query: string) =>
  api<Paginated<ProductSummary>>(`/products?${query}`).then((r) => r.items).catch(() => [] as ProductSummary[]);
const banners = (placement: string) => api<Banner[]>(`/banners?placement=${placement}`).catch(() => [] as Banner[]);

export default async function HomePage() {
  const [heroBanners, stripBanners, gold, diamond, silver, artificial, newArrivals, bestsellers, bridal] = await Promise.all([
    banners('HOME_HERO'),
    banners('HOME_STRIP'),
    products('line=GOLD&pageSize=4'),
    products('line=DIAMOND&pageSize=4'),
    products('line=SILVER&pageSize=4'),
    products('line=ARTIFICIAL&pageSize=4'),
    products('collection=new-arrivals&pageSize=8'),
    products('collection=bestsellers&pageSize=4'),
    products('collection=bridal&pageSize=4'),
  ]);
  const hero = heroBanners[0];
  const lineSections = [
    { line: LINES[0], items: gold },
    { line: LINES[2], items: diamond },
    { line: LINES[1], items: silver },
    { line: LINES[3], items: artificial },
  ].filter((s) => s.items.length);

  return (
    <>
      {/* Hero — a live CMS "Home hero" campaign replaces the brand hero automatically */}
      <section className="hero" aria-label="SeSha Stone">
        {hero ? (
          <div className="hero__media">
            <picture>
              {hero.mobileImageUrl && <source media="(max-width: 767px)" srcSet={hero.mobileImageUrl} />}
              {hero.tabletImageUrl && <source media="(max-width: 1279px)" srcSet={hero.tabletImageUrl} />}
              <img src={hero.imageUrl} alt="" fetchPriority="high" />
            </picture>
          </div>
        ) : (
          <div className="hero__art" aria-hidden="true">
            <div className="hero__art-mark"><BrandMark size={380} /></div>
          </div>
        )}
        <div className="container hero__inner">
          <p className="hero__brand">SeSha Stone</p>
          <h1>{hero?.title ?? 'TIMELESS ELEGANCE'}</h1>
          <p className="hero__sub">{hero?.subtitle ?? 'Discover jewellery designed for life’s most beautiful moments.'}</p>
          <div className="hero__actions">
            <Link href={hero?.linkUrl ?? '/collections'} className="btn btn--gold">{hero?.ctaLabel ?? 'Explore Collection'}</Link>
            <Link href="/collections/new-arrivals" className="btn btn--ghost-light">New Arrivals</Link>
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="shop-by-category">
        <div className="lux-heading lux-heading--center">
          <p className="eyebrow">Shop by category</p>
          <h2 id="shop-by-category">Four ways to shine</h2>
        </div>
        <div className="lines">
          {LINES.map((line) => (
            <Link key={line.key} href={line.path} className={`line-tile line-tile--${line.key === 'premium-artificial' ? 'artificial' : line.key}`}>
              <Icon name={line.key === 'premium-artificial' ? 'artificial' : (line.key as 'gold' | 'silver' | 'diamond')} size={40} />
              <h3>{line.label}</h3>
              <span>Explore →</span>
            </Link>
          ))}
        </div>
      </section>

      {lineSections.map(({ line, items }, i) => (
        <section key={line.key} className={`section${i % 2 === 0 ? ' section--muted' : ''}`}>
          <div className="container">
            <div className="section__head">
              <LuxuryHeading eyebrow="SeSha Stone" title={line.label} intro={line.intro} />
              <Link href={line.path} className="more-link">View all</Link>
            </div>
            <ProductGrid products={items} />
          </div>
        </section>
      ))}

      {!!newArrivals.length && (
        <section className="section container">
          <div className="section__head">
            <LuxuryHeading eyebrow="Just in" title="New Arrivals" />
            <Link href="/collections/new-arrivals" className="more-link">View all</Link>
          </div>
          <ProductGrid products={newArrivals.slice(0, 8)} />
        </section>
      )}

      {!!bestsellers.length && (
        <section className="section section--muted">
          <div className="container">
            <div className="section__head">
              <LuxuryHeading eyebrow="Most loved" title="Bestsellers" />
              <Link href="/collections/bestsellers" className="more-link">View all</Link>
            </div>
            <ProductGrid products={bestsellers} />
          </div>
        </section>
      )}

      <section className="section container" aria-labelledby="bridal">
        <div className="editorial">
          <div className="editorial__art" aria-hidden="true"><BrandMark size={200} /></div>
          <div className="editorial__copy">
            <p className="eyebrow">Bridal Collection</p>
            <h2 id="bridal">For your special day</h2>
            <p>Heirloom-worthy pieces for the bride and the celebrations around her.</p>
            <Link href="/collections/bridal" className="btn btn--gold" style={{ justifySelf: 'start' }}>Explore Bridal</Link>
          </div>
        </div>
        {!!bridal.length && <div style={{ marginTop: 32 }}><ProductGrid products={bridal} /></div>}
      </section>

      {stripBanners[0] && (
        <section className="section--tight container" aria-label="Campaign">
          <CampaignBanner banner={stripBanners[0]} />
        </section>
      )}

      <section className="section section--muted" aria-labelledby="why">
        <div className="container">
          <LuxuryHeading center eyebrow="The SeSha Stone promise" title="Why SeSha Stone" as="h2" />
          <div className="values">
            <div className="value">
              <Icon name="diamond" size={34} />
              <h3>Clear about every piece</h3>
              <p>Metal, purity, stones and weight are shown only when verified — and premium artificial jewellery is always labelled as such.</p>
            </div>
            <div className="value">
              <Icon name="secure" size={34} />
              <h3>Verified payments</h3>
              <p>Every UPI and bank transfer is checked against our statement before your order is confirmed. We never ask for your PIN or OTP.</p>
            </div>
            <div className="value">
              <Icon name="support" size={34} />
              <h3>People who care</h3>
              <p>Talk to us for sizing, styling or anything about your order — before and after you buy.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section container" aria-labelledby="newsletter">
        <div className="newsletter">
          <LuxuryHeading eyebrow="Stay in touch" title="New collections, first" intro="Be the first to see new arrivals and festive collections. No spam — unsubscribe anytime." />
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
