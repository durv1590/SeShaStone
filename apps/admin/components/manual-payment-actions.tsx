'use client';

import { useState } from 'react';
import { api, openPrivateFile } from '@/lib/api';
import { useSession } from './session';

export const MANUAL_PROVIDERS = ['UPI_DIRECT', 'BANK_TRANSFER'];

export interface EvidenceMeta {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

/** Opens customer-uploaded payment proof (private, authenticated). */
export function EvidenceLinks({ evidence }: { evidence?: EvidenceMeta[] }) {
  if (!evidence?.length) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
      {evidence.map((e) => (
        <button key={e.id} type="button" className="btn btn-ghost btn-sm" onClick={() => openPrivateFile(`/admin/payment-evidence/${e.id}`)}>
          {e.mimeType === 'application/pdf' ? 'PDF' : 'Image'}: {e.fileName}
        </button>
      ))}
    </span>
  );
}

/**
 * Verify / reject for pending UPI or bank-transfer payments. Staff must check the actual bank or
 * UPI statement — a UTR or screenshot alone is never proof of payment.
 */
export function ManualPaymentActions({
  payment,
  onDone,
}: {
  payment: { id: string; provider: string; status: string; providerPaymentId: string | null; amount: number };
  onDone: () => void;
}) {
  const { can } = useSession();
  const [error, setError] = useState<string | null>(null);
  if (!can('payments.verify') || !MANUAL_PROVIDERS.includes(payment.provider) || !['PENDING', 'SUBMITTED'].includes(payment.status)) {
    return null;
  }

  async function verify() {
    const amount = (payment.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const ok = window.confirm(
      `Confirm you have checked the ${payment.provider === 'UPI_DIRECT' ? 'UPI' : 'bank'} statement and received ${amount}` +
        `${payment.providerPaymentId ? ` with reference ${payment.providerPaymentId}` : ''}.\n\nThe order will be marked paid.`,
    );
    if (!ok) return;
    try {
      await api(`/admin/payments/${payment.id}/verify`, { method: 'POST' });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function reject() {
    const reason = window.prompt('Why is this payment being rejected? The customer will see this message.');
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/admin/payments/${payment.id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason.trim() }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-sm" onClick={verify}>Verify payment</button>
      {payment.status === 'SUBMITTED' && <button className="btn btn-sm btn-danger" onClick={reject}>Reject</button>}
      {error && <span className="error">{error}</span>}
    </span>
  );
}
