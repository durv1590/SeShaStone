import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductListing, SearchParams } from '@/components/product-listing';
import { Breadcrumbs } from '@/components/ui';
import { lineByKey } from '@/lib/lines';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ line: string; sub: string }>; searchParams: Promise<SearchParams> };

function resolve(lineKey: string, subSlug: string) {
  const line = lineByKey(lineKey);
  const sub = line?.subcategories.find((s) => s.slug === subSlug);
  return line && sub ? { line, sub } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const r = resolve(p.line, p.sub);
  if (!r) return {};
  const title = r.line.line === 'ARTIFICIAL' ? `${r.sub.label} — Premium Artificial` : `${r.line.short} ${r.sub.label.replace(/^Diamond /, '')}`;
  return pageMetadata({ title, description: `Shop ${title.toLowerCase()} at SeSha Stone. ${r.line.intro}`, path: `${r.line.path}/${r.sub.slug}` });
}

/** e.g. /gold/rings, /silver/anklets, /diamond/rings, /premium-artificial/necklaces */
export default async function SubcategoryPage({ params, searchParams }: Props) {
  const p = await params;
  const r = resolve(p.line, p.sub);
  if (!r) notFound();
  const { line, sub } = r;
  return (
    <>
      <Breadcrumbs items={[{ name: line.label, path: line.path }, { name: sub.label, path: `${line.path}/${sub.slug}` }]} />
      <section className={`collection-hero${line.line === 'ARTIFICIAL' ? ' collection-hero--emerald' : ''}`}>
        <div className="container">
          <p className="eyebrow">{line.label}</p>
          <h1>{sub.label}</h1>
        </div>
      </section>
      <ProductListing
        basePath={`${line.path}/${sub.slug}`}
        fixed={{ line: line.line, category: sub.slug }}
        searchParams={await searchParams}
        subcategories={[
          { slug: 'all', label: 'All', href: line.path, active: false },
          ...line.subcategories.map((s) => ({ slug: s.slug, label: s.label, href: `${line.path}/${s.slug}`, active: s.slug === sub.slug })),
        ]}
      />
    </>
  );
}
