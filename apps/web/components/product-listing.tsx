import Link from 'next/link';
import { api, Paginated, ProductSummary } from '@/lib/api';
import { LINES } from '@/lib/lines';
import { ProductGrid } from './product-card';
import { Pagination } from './ui';

export type SearchParams = Record<string, string | string[] | undefined>;

export const PRICE_BANDS = [
  { value: '0-500000', label: 'Under ₹5,000' },
  { value: '500000-2500000', label: '₹5,000 – ₹25,000' },
  { value: '2500000-5000000', label: '₹25,000 – ₹50,000' },
  { value: '5000000-10000000', label: '₹50,000 – ₹1,00,000' },
  { value: '10000000-', label: 'Above ₹1,00,000' },
];
const OCCASIONS = ['bridal', 'wedding', 'festive', 'party', 'everyday', 'office'];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'bestselling', label: 'Bestselling' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Server-rendered product listing with GET-form filters (works without JavaScript).
 * `fixed` holds the constraints implied by the URL (e.g. /gold/rings → line=GOLD&category=rings).
 */
export async function ProductListing({
  basePath,
  fixed,
  searchParams,
  subcategories,
  showLineFilter = false,
}: {
  basePath: string;
  fixed: Record<string, string>;
  searchParams: SearchParams;
  subcategories?: { slug: string; label: string; href: string; active: boolean }[];
  showLineFilter?: boolean;
}) {
  const params = {
    q: first(searchParams.q),
    sort: first(searchParams.sort),
    price: first(searchParams.price),
    tag: first(searchParams.tag),
    size: first(searchParams.size),
    inStock: first(searchParams.inStock),
    line: first(searchParams.line),
    page: first(searchParams.page),
  };
  const query = new URLSearchParams({ ...fixed, pageSize: '24' });
  for (const key of ['q', 'sort', 'tag', 'size', 'page'] as const) if (params[key]) query.set(key, params[key]!);
  if (params.inStock === 'true') query.set('inStock', 'true');
  if (showLineFilter && params.line) query.set('line', params.line);
  if (params.price) {
    const [min, max] = params.price.split('-');
    if (min) query.set('minPrice', min);
    if (max) query.set('maxPrice', max);
  }

  const data = await api<Paginated<ProductSummary>>(`/products?${query}`).catch(
    () => ({ items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 }) as Paginated<ProductSummary>,
  );

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== 'page') next.set(k, v);
    next.set('page', String(p));
    return `${basePath}?${next}`;
  };
  const active = Object.entries(params).filter(([k, v]) => v && k !== 'page' && k !== 'sort' && k !== 'q');

  const filters = (
    <form className="filters" action={basePath} aria-label="Filter jewellery">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      {showLineFilter && (
        <fieldset>
          <legend>Material</legend>
          <select name="line" className="select" defaultValue={params.line ?? ''} aria-label="Material">
            <option value="">All jewellery</option>
            {LINES.map((l) => <option key={l.line} value={l.line}>{l.label}</option>)}
          </select>
        </fieldset>
      )}
      <fieldset>
        <legend>Price</legend>
        <select name="price" className="select" defaultValue={params.price ?? ''} aria-label="Price range">
          <option value="">Any price</option>
          {PRICE_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </fieldset>
      <fieldset>
        <legend>Occasion</legend>
        <select name="tag" className="select" defaultValue={params.tag ?? ''} aria-label="Occasion">
          <option value="">Any occasion</option>
          {OCCASIONS.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
        </select>
      </fieldset>
      <fieldset>
        <legend>Size</legend>
        <input name="size" className="input" defaultValue={params.size ?? ''} placeholder="e.g. 12" aria-label="Size" />
      </fieldset>
      <fieldset>
        <legend>Availability</legend>
        <label className="check"><input type="checkbox" name="inStock" value="true" defaultChecked={params.inStock === 'true'} /> In stock only</label>
      </fieldset>
      <fieldset>
        <legend>Sort</legend>
        <select name="sort" className="select" defaultValue={params.sort ?? 'newest'} aria-label="Sort by">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </fieldset>
      <button className="btn btn--block">Apply</button>
      {active.length > 0 && <Link href={params.q ? `${basePath}?q=${encodeURIComponent(params.q)}` : basePath} className="link muted">Clear filters</Link>}
    </form>
  );

  return (
    <div className="container section--tight">
      <div className="listing">
        {filters}
        <div>
          <details className="filters-mobile">
            <summary>Filter &amp; sort{active.length ? ` (${active.length})` : ''}</summary>
            {filters}
          </details>
          <div className="listing__bar">
            {subcategories?.length ? (
              <nav className="chips" aria-label="Categories">
                {subcategories.map((s) => (
                  <Link key={s.slug} href={s.href} className="chip" aria-current={s.active ? 'page' : undefined}>{s.label}</Link>
                ))}
              </nav>
            ) : <span />}
            <p className="muted" style={{ margin: 0 }} role="status">{data.total} {data.total === 1 ? 'piece' : 'pieces'}</p>
          </div>
          {data.items.length ? (
            <ProductGrid products={data.items} columns={3} />
          ) : (
            <div className="empty">
              <p>No pieces match your selection yet.</p>
              <Link href="/collections/new-arrivals" className="link">See new arrivals</Link>
            </div>
          )}
          <Pagination page={data.page} totalPages={data.totalPages} href={pageHref} />
        </div>
      </div>
    </div>
  );
}
