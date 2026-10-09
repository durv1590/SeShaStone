'use client';

import { FormEvent, useState } from 'react';
import { api, PaymentInstructions } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { CopyButton } from './copy-button';
import { StatusPill } from './ui';

function UpiQrPayment({ info }: { info: PaymentInstructions }) {
  const upi = info.upi!;
  return (
    <div className="pay">
      {upi.qrImage ? (
        <div className="pay__qr">
          {/* The original, verified QR — displayed unmodified. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={upi.qrImage} alt={`UPI QR code for ${upi.upiId}`} />
        </div>
      ) : (
        <p className="notice" style={{ margin: 0 }}>Pay to the UPI ID shown here from any UPI app.</p>
      )}
      <div className="stack">
        <p style={{ margin: 0 }}>Scan with GPay, PhonePe, Paytm or any UPI app, then enter <strong>{formatPrice(info.amount)}</strong>.</p>
        <dl className="kv">
          <dt>UPI ID</dt>
          <dd>{upi.upiId} <CopyButton value={upi.upiId} label="UPI ID" /></dd>
          <dt>Name</dt>
          <dd>{upi.payeeName}</dd>
          <dt>Amount</dt>
          <dd>{formatPrice(info.amount)} <CopyButton value={(info.amount / 100).toFixed(2)} label="amount" /></dd>
          <dt>Order reference</dt>
          <dd>{info.reference} <CopyButton value={info.reference} label="order reference" /></dd>
        </dl>
        {upi.intentUri && <a href={upi.intentUri} className="btn btn--outline" style={{ justifySelf: 'start' }}>Open UPI app</a>}
        {upi.instructions && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line', fontSize: '0.88rem' }}>{upi.instructions}</p>}
      </div>
    </div>
  );
}

function BankTransferDetails({ info }: { info: PaymentInstructions }) {
  const b = info.bank!;
  return (
    <div className="stack">
      <p style={{ margin: 0 }}>Transfer <strong>{formatPrice(info.amount)}</strong> by NEFT or IMPS. Please enter your order number <strong>{info.reference}</strong> in the transfer remarks.</p>
      <dl className="kv">
        <dt>Bank</dt><dd>{b.bankName} <CopyButton value={b.bankName} label="bank name" /></dd>
        <dt>Account holder</dt><dd>{b.accountName} <CopyButton value={b.accountName} label="account holder" /></dd>
        <dt>Account number</dt><dd>{b.accountNumber} <CopyButton value={b.accountNumber} label="account number" /></dd>
        <dt>IFSC</dt><dd>{b.ifsc} <CopyButton value={b.ifsc} label="IFSC" /></dd>
        {b.branch && <><dt>Branch</dt><dd>{b.branch}</dd></>}
        <dt>Amount</dt><dd>{formatPrice(info.amount)}</dd>
        <dt>Remarks / reference</dt><dd>{info.reference} <CopyButton value={info.reference} label="order reference" /></dd>
      </dl>
      {b.instructions && <p className="muted" style={{ margin: 0, whiteSpace: 'pre-line', fontSize: '0.88rem' }}>{b.instructions}</p>}
    </div>
  );
}

/**
 * Payment step for UPI / bank-transfer orders. Submitting a UTR or screenshot only puts the payment
 * under verification — the order is confirmed after staff match it with the bank statement.
 */
export function OrderPayment({ orderId, token, initial, onChange }: { orderId: string; token: string; initial: PaymentInstructions; onChange: () => void }) {
  const [info, setInfo] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitReference(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reference = String(new FormData(e.currentTarget).get('reference') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      setInfo(await api<PaymentInstructions>(`/me/orders/${orderId}/payment-reference`, { method: 'POST', token, body: JSON.stringify({ reference }) }));
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('File must be 5 MB or smaller');
    const body = new FormData();
    body.append('file', file);
    setBusy(true);
    setError(null);
    try {
      setInfo(await api<PaymentInstructions>(`/me/orders/${orderId}/payment-evidence`, { method: 'POST', token, body }));
      form.reset();
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (info.orderStatus !== 'PENDING_PAYMENT') return null;
  const submitted = info.paymentStatus === 'SUBMITTED';

  return (
    <section className="panel" aria-labelledby="pay-title">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 id="pay-title">{info.upi ? 'Pay by UPI' : 'Pay by bank transfer'}</h2>
        <StatusPill status={info.paymentStatus} />
      </div>

      {info.rejectionReason && (
        <p className="notice notice--error" role="alert" style={{ margin: 0 }}>
          We could not verify your earlier payment reference: {info.rejectionReason}. Please check it and submit again.
        </p>
      )}

      {info.upi ? <UpiQrPayment info={info} /> : <BankTransferDetails info={info} />}

      {submitted ? (
        <p className="notice notice--success" role="status" style={{ margin: 0 }}>
          {info.message}
          {info.submittedReference && <><br />Reference submitted: <strong>{info.submittedReference}</strong></>}
          <br />Order reference: <strong>{info.reference}</strong>
        </p>
      ) : (
        <form className="form" onSubmit={submitReference}>
          <label className="field">
            After paying, enter the UTR / UPI transaction ID
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" name="reference" required minLength={6} maxLength={30} pattern="[A-Za-z0-9]{6,30}" placeholder="e.g. 427812345678" autoComplete="off" />
              <button className="btn" disabled={busy}>Submit</button>
            </div>
          </label>
        </form>
      )}

      <form className="form" onSubmit={upload}>
        <label className="field">
          Payment screenshot or PDF <small>(optional · PNG, JPEG, WebP or PDF · up to 5 MB)</small>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="input" type="file" name="file" accept="image/png,image/jpeg,image/webp,application/pdf" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn btn--outline" disabled={busy}>Upload</button>
          </div>
        </label>
        {info.evidence.length > 0 && (
          <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>Uploaded: {info.evidence.map((e) => e.fileName).join(', ')}</p>
        )}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
        We never ask for your UPI PIN, OTP, card details or banking password. Screenshots alone do not confirm payment — we verify every transfer against our bank statement.
      </p>
    </section>
  );
}
