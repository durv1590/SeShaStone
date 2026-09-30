import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductListing, SearchParams } from '@/components/product-listing';
import { Breadcrumbs } from '@/components/ui';
import { api, ApiError, Collection } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

async function getCollection(slug: string) {
  try {
    return await api<Collection>(`/collections/${encodeURIComponent(slug)}`, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  return pageMetadata({
    title: c.seoTitle ?? c.name,
    description: c.seoDescription ?? c.heroSubtitle ?? c.description ?? undefined,
    path: `/collections/${c.slug}`,
    image: c.heroImageUrl,
  });
}

/** Reusable collection template: hero → intro → filters → grid → pagination → SEO copy. */
export default async function CollectionPage({ params, searchParams }: Props) {
  const c = await getCollection((await params).slug);
  const theme = c.heroImageUrl ? 'image' : (c.theme ?? '');
  return (
    <>
      <Breadcrumbs items={[{ name: 'Collections', path: '/collections' }, { name: c.name, path: `/collections/${c.slug}` }]} />
      <section className={`collection-hero${theme ? ` collection-hero--${theme}` : ''}`}>
        {c.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.heroImageUrl} alt="" fetchPriority="high" />
        )}
        <div className="container">
          <p className="eyebrow">Collection</p>
          <h1>{c.heroTitle ?? c.name}</h1>
          {c.heroSubtitle && <p>{c.heroSubtitle}</p>}
        </div>
      </section>
      <ProductListing basePath={`/collections/${c.slug}`} fixed={{ collection: c.slug }} searchParams={await searchParams} showLineFilter />
      {c.description && (
        <section className="section--tight container">
          <div className="prose muted"><p>{c.description}</p></div>
        </section>
      )}
    </>
  );
}
