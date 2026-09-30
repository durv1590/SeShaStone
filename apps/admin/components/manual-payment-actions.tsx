'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export const MANUAL_PROVIDERS = ['UPI_DIRECT', 'BANK_TRANSFER'];

/** Confirm / reject buttons for a pending direct-UPI or bank-transfer payment. */
export function ManualPaymentActions({
  payment,
  onDone,
}: {
  payment: { id: string; provider: string; status: string; providerPaymentId: string | null };
  onDone: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  if (!MANUAL_PROVIDERS.includes(payment.provider) || payment.status !== 'PENDING') return null;

  async function act(action: 'confirm' | 'reject') {
    const question =
      action === 'confirm'
        ? `Confirm you received this payment${payment.providerPaymentId ? ` (UTR ${payment.providerPaymentId})` : ''}? The order will be marked paid.`
        : 'Reject this reference? The customer will be asked to submit a correct UTR.';
    if (!confirm(question)) return;
    const reason = action === 'reject' ? (prompt('Reason (optional)') ?? undefined) : undefined;
    try {
      await api(`/admin/payments/${payment.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'reject' ? { reason } : {}),
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <button className="btn btn-sm" onClick={() => act('confirm')}>Confirm</button>
      {payment.providerPaymentId && (
        <button className="btn btn-sm btn-danger" onClick={() => act('reject')}>Reject</button>
      )}
      {error && <span className="error">{error}</span>}
    </span>
  );
}
