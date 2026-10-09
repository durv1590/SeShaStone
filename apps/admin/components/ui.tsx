'use client';

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'bad' | undefined> = {
  ACTIVE: 'ok',
  PAID: 'ok',
  DELIVERED: 'ok',
  CAPTURED: 'ok',
  APPROVED: 'ok',
  SENT: 'ok',
  PENDING_PAYMENT: 'warn',
  PENDING: 'warn',
  PROCESSING: 'warn',
  SHIPPED: 'warn',
  PACKED: 'warn',
  OUT_FOR_DELIVERY: 'warn',
  SUBMITTED: 'warn',
  RETURN_REQUESTED: 'warn',
  REQUESTED: 'warn',
  RETURNED: 'ok',
  RECEIVED: 'ok',
  PROCESSED: 'ok',
  SKIPPED: 'warn',
  EXPIRED: 'bad',
  PARTIALLY_REFUNDED: 'bad',
  DRAFT: 'warn',
  SCHEDULED: 'warn',
  CANCELLED: 'bad',
  FAILED: 'bad',
  REFUNDED: 'bad',
  REJECTED: 'bad',
  ARCHIVED: 'bad',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_TONE[status] ?? ''}`}>{status.replace(/_/g, ' ').toLowerCase()}</span>;
}

export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages}
      </span>
      <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
