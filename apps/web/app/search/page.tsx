import type { Metadata } from 'next';
import { ProductListing, SearchParams } from '@/components/product-listing';
import { pageMetadata } from '@/lib/seo';

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = (await searchParams).q;
  return pageMetadata({ title: q ? `Search: ${q}` : 'Search', path: '/search', noindex: true });
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  return (
    <>
      <section className="collection-hero">
        <div className="container">
          <p className="eyebrow">Search</p>
          <h1>{q ? `“${q}”` : 'Search our jewellery'}</h1>
          <form action="/search" role="search" style={{ display: 'flex', gap: 10, maxWidth: 560, margin: '24px auto 0' }}>
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" className="input" defaultValue={q} placeholder="Diamond rings, gold earrings, bridal…" />
            <button className="btn">Search</button>
          </form>
        </div>
      </section>
      <ProductListing basePath="/search" fixed={{}} searchParams={params} showLineFilter />
    </>
  );
}
