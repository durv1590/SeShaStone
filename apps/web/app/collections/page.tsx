import Link from 'next/link';
import { BrandMark } from '@/components/brand';
import { Breadcrumbs, LuxuryHeading } from '@/components/ui';
import { api, Collection } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Collections', path: '/collections' });

export default async function CollectionsPage() {
  const collections = await api<Collection[]>('/collections').catch(() => [] as Collection[]);
  return (
    <>
      <Breadcrumbs items={[{ name: 'Collections', path: '/collections' }]} />
      <section className="section container" style={{ paddingTop: 24 }}>
        <LuxuryHeading as="h1" center eyebrow="SeSha Stone" title="Collections" intro="Curated stories in gold, silver, diamond and premium artificial jewellery." />
        <div className="lines">
          {collections.map((c) => (
            <Link key={c.id} href={`/collections/${c.slug}`} className={`line-tile${c.theme === 'emerald' ? ' line-tile--artificial' : ''}`} style={c.theme === 'burgundy' ? { background: 'var(--ss-burgundy)' } : undefined}>
              <BrandMark size={40} />
              <h3>{c.name}</h3>
              <span>Explore →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
