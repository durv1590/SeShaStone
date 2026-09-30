import { ProductListing, SearchParams } from '@/components/product-listing';
import { Breadcrumbs } from '@/components/ui';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'All Jewellery', path: '/products' });

export default async function AllProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <Breadcrumbs items={[{ name: 'All Jewellery', path: '/products' }]} />
      <section className="collection-hero">
        <div className="container">
          <p className="eyebrow">SeSha Stone</p>
          <h1>All Jewellery</h1>
        </div>
      </section>
      <ProductListing basePath="/products" fixed={{}} searchParams={await searchParams} showLineFilter />
    </>
  );
}
