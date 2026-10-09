import Link from 'next/link';
import { JsonLd } from './json-ld';
import { breadcrumbJsonLd } from '@/lib/seo';

export function LuxuryHeading({
  eyebrow,
  title,
  intro,
  center = false,
  as: Tag = 'h2',
}: {
  eyebrow?: string;
  title: string;
  intro?: string | null;
  center?: boolean;
  as?: 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={`lux-heading${center ? ' lux-heading--center' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <Tag>{title}</Tag>
      {intro && <p>{intro}</p>}
    </div>
  );
}

export function LuxuryDivider({ label }: { label?: string }) {
  return (
    <div className="divider" role="separator">
      {label && <span className="eyebrow" style={{ margin: 0 }}>{label}</span>}
    </div>
  );
}

/** Visible breadcrumbs + BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  const all = [{ name: 'Home', path: '/' }, ...items];
  return (
    <nav className="breadcrumbs container" aria-label="Breadcrumb">
      <ol>
        {all.map((item, i) => (
          <li key={item.path}>
            {i === all.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbJsonLd(all)} />
    </nav>
  );
}

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link className="btn btn--outline btn--sm" href={href(page - 1)} rel="prev">Previous</Link> : <span />}
      <span className="muted">Page {page} of {totalPages}</span>
      {page < totalPages ? <Link className="btn btn--outline btn--sm" href={href(page + 1)} rel="next">Next</Link> : <span />}
    </nav>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
  REFUNDED: 'Refunded',
  // payment
  PENDING: 'Awaiting payment',
  SUBMITTED: 'Under verification',
  CAPTURED: 'Paid',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
  PARTIALLY_REFUNDED: 'Partially refunded',
  PROCESSED: 'Processed',
};
const TONE: Record<string, string> = {
  PAID: 'ok', DELIVERED: 'ok', CAPTURED: 'ok', PROCESSED: 'ok', RETURNED: 'ok',
  PENDING_PAYMENT: 'warn', PENDING: 'warn', SUBMITTED: 'warn', PROCESSING: 'warn', PACKED: 'warn', SHIPPED: 'warn', OUT_FOR_DELIVERY: 'warn', RETURN_REQUESTED: 'warn',
  CANCELLED: 'bad', FAILED: 'bad', EXPIRED: 'bad', REFUNDED: 'bad', PARTIALLY_REFUNDED: 'bad',
};

export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ').toLowerCase();

export function StatusPill({ status }: { status: string }) {
  return <span className={`status status--${TONE[status] ?? ''}`}>{statusLabel(status)}</span>;
}
