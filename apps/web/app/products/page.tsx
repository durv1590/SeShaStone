import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/product-card';
import { api, Paginated, ProductSummary } from '@/lib/api';

export const metadata: Metadata = { title: 'Shop' };

const METALS = ['GOLD', 'SILVER', 'PLATINUM', 'ROSE_GOLD', 'WHITE_GOLD'];

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ['q', 'category', 'metal', 'sort', 'page']) {
    if (params[key]) query.set(key, params[key]!);
  }
  query.set('pageSize', '24');
  const data = await api<Paginated<ProductSummary>>(`/products?${query}`);
  const page = data.page;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(query);
    next.set('page', String(p));
    next.delete('pageSize');
    return `/products?${next}`;
  };

  return (
    <div className="container section">
      <h1 className="section-title">{params.category ? params.category.replace(/-/g, ' ') : 'All jewellery'}</h1>
      <form className="filters" action="/products">
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <input className="input" name="q" placeholder="Search rings, ruby, 22K…" defaultValue={params.q} />
        <select name="metal" defaultValue={params.metal ?? ''}>
          <option value="">All metals</option>
          {METALS.map((m) => (
            <option key={m} value={m}>{m.replace('_', ' ').toLowerCase()}</option>
          ))}
        </select>
        <select name="sort" defaultValue={params.sort ?? 'newest'}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        <button className="btn btn-outline" type="submit">Apply</button>
      </form>

      {data.items.length ? (
        <div className="grid">
          {data.items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <p className="muted">No pieces match your filters.</p>
      )}

      {data.totalPages > 1 && (
        <div className="filters" style={{ marginTop: 32, justifyContent: 'center' }}>
          {page > 1 && <Link className="chip" href={pageHref(page - 1)}>← Previous</Link>}
          <span className="muted">Page {page} of {data.totalPages}</span>
          {page < data.totalPages && <Link className="chip" href={pageHref(page + 1)}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
