import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductListing, SearchParams } from '@/components/product-listing';
import { Breadcrumbs } from '@/components/ui';
import { lineByKey } from '@/lib/lines';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ line: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const line = lineByKey((await params).line);
  if (!line) return {};
  return pageMetadata({ title: line.label, description: `${line.intro} Shop ${line.label.toLowerCase()} online at SeSha Stone.`, path: line.path });
}

/** /gold, /silver, /diamond, /premium-artificial */
export default async function LinePage({ params, searchParams }: Props) {
  const line = lineByKey((await params).line);
  if (!line) notFound();
  return (
    <>
      <Breadcrumbs items={[{ name: line.label, path: line.path }]} />
      <section className={`collection-hero${line.line === 'ARTIFICIAL' ? ' collection-hero--emerald' : ''}`}>
        <div className="container">
          <p className="eyebrow">SeSha Stone</p>
          <h1>{line.label}</h1>
          <p>{line.intro}</p>
        </div>
      </section>
      <ProductListing
        basePath={line.path}
        fixed={{ line: line.line }}
        searchParams={await searchParams}
        subcategories={[
          { slug: 'all', label: 'All', href: line.path, active: true },
          ...line.subcategories.map((s) => ({ slug: s.slug, label: s.label, href: `${line.path}/${s.slug}`, active: false })),
        ]}
      />
    </>
  );
}
