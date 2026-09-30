'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { withConfirmation } from '@/components/confirm';
import { useSession } from '@/components/session';
import { formatDate } from '@/components/ui';
import { api, Paginated } from '@/lib/api';

interface AdminSettings {
  values: Record<string, unknown>;
  sensitiveKeys: string[];
  meta: Record<string, { updatedAt: string; updatedBy: string | null }>;
}

interface QrInfo {
  present: boolean;
  dataUrl?: string;
  decoded?: { upiId: string; payeeName: string | null; merchantCode: string | null } | null;
  matchesUpiId?: boolean;
  updatedAt?: string;
  uploadedBy?: string | null;
  sha256?: string;
}

interface AuditRow {
  id: string;
  action: string;
  actorEmail: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

const PROVIDERS: [string, string][] = [
  ['UPI_DIRECT', 'UPI (store UPI ID / QR)'],
  ['BANK_TRANSFER', 'Bank transfer (NEFT / IMPS)'],
  ['RAZORPAY', 'Razorpay gateway'],
  ['CASHFREE', 'Cashfree gateway'],
  ['UPI', 'UPI via gateway'],
];

const rupees = (paise: unknown) => String(Number(paise ?? 0) / 100);
const toPaise = (v: FormDataEntryValue | null) => Math.round(Number(v || 0) * 100);

export default function SettingsPage() {
  const { can } = useSession();
  const [data, setData] = useState<AdminSettings | null>(null);
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [history, setHistory] = useState<AuditRow[]>([]);
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [revealed, setRevealed] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const qrInput = useRef<HTMLInputElement>(null);
  const canBusiness = can('settings.business.edit');
  const canPayment = can('settings.payment.edit');

  const load = useCallback(async () => {
    const [s, q, h] = await Promise.all([
      api<AdminSettings>('/admin/settings'),
      api<QrInfo>('/admin/settings/upi-qr'),
      api<Paginated<AuditRow>>('/admin/settings/history'),
    ]);
    setData(s);
    setQr(q);
    setHistory(h.items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save(section: string, values: Record<string, unknown>, financial = false) {
    setStatus((st) => ({ ...st, [section]: { ok: true, text: 'Saving…' } }));
    try {
      const result = await withConfirmation((confirmFinancialChange) =>
        api<AdminSettings>('/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({ values, ...(financial && { confirmFinancialChange }) }),
        }),
      );
      if (!result) return setStatus((st) => ({ ...st, [section]: { ok: false, text: 'Not saved' } }));
      setRevealed(null);
      await load();
      setStatus((st) => ({ ...st, [section]: { ok: true, text: 'Saved' } }));
    } catch (err) {
      setStatus((st) => ({ ...st, [section]: { ok: false, text: (err as Error).message } }));
    }
  }

  async function reveal() {
    const r = await api<{ value: string }>('/admin/settings/reveal', { method: 'POST', body: JSON.stringify({ key: 'payments.bankAccountNumber' }) });
    setRevealed(r.value);
    setFormKey((k) => k + 1);
    void load();
  }

  async function uploadQr() {
    const file = qrInput.current?.files?.[0];
    if (!file) return;
    setStatus((st) => ({ ...st, qr: { ok: true, text: 'Checking QR…' } }));
    try {
      const result = await withConfirmation((confirm) => {
        const body = new FormData();
        body.append('file', file);
        if (confirm) body.append('confirm', 'true');
        return api<QrInfo>('/admin/settings/upi-qr', { method: 'POST', body });
      });
      if (result) {
        setQr(result);
        setStatus((st) => ({ ...st, qr: { ok: true, text: 'QR verified and saved' } }));
        if (qrInput.current) qrInput.current.value = '';
        void load();
      } else setStatus((st) => ({ ...st, qr: { ok: false, text: 'Upload cancelled' } }));
    } catch (err) {
      setStatus((st) => ({ ...st, qr: { ok: false, text: (err as Error).message } }));
    }
  }

  async function removeQr() {
    if (!confirm('Remove the UPI QR? Customers will see the UPI ID only.')) return;
    await api('/admin/settings/upi-qr', { method: 'DELETE' });
    await load();
  }

  if (!data) return <p className="muted">Loading…</p>;
  const v = data.values;
  const str = (k: string) => String(v[k] ?? '');
  const enabled = (v['payments.enabledProviders'] as string[]) ?? [];
  const Msg = ({ id }: { id: string }) =>
    status[id] ? <span className={status[id].ok ? 'muted' : 'error'} role="status">{status[id].text}</span> : null;
  const Updated = ({ k }: { k: string }) =>
    data.meta[k] ? <small className="muted"> · updated {formatDate(data.meta[k].updatedAt)} by {data.meta[k].updatedBy ?? '—'}</small> : null;

  return (
    <>
      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: -12 }}>
        Business, contact and payment details used across the website. Changes apply within a minute of saving. API keys and email credentials are server environment variables, not settings.
      </p>

      {/* ── Business information ─────────────────────────── */}
      <form
        className="panel form"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save('business', Object.fromEntries(['store.name', 'store.legalName', 'store.website', 'store.supportEmail', 'store.supportPhone', 'store.whatsapp', 'store.address', 'store.gstin'].map((k) => [k, f.get(k)])));
        }}
      >
        <h2>Business information</h2>
        <fieldset disabled={!canBusiness} style={{ border: 0, padding: 0, margin: 0 }} className="form-grid">
          <label className="field">Brand name<input className="input" name="store.name" defaultValue={str('store.name')} /></label>
          <label className="field">Company (legal name)<input className="input" name="store.legalName" defaultValue={str('store.legalName')} /></label>
          <label className="field">Website<input className="input" name="store.website" defaultValue={str('store.website')} /></label>
          <label className="field">Support email<input className="input" type="email" name="store.supportEmail" defaultValue={str('store.supportEmail')} /></label>
          <label className="field">Support mobile<input className="input" name="store.supportPhone" defaultValue={str('store.supportPhone')} /></label>
          <label className="field">WhatsApp number<input className="input" name="store.whatsapp" defaultValue={str('store.whatsapp')} placeholder="+91…" /></label>
          <label className="field">Business address<input className="input" name="store.address" defaultValue={str('store.address')} /></label>
          <label className="field">GSTIN<input className="input" name="store.gstin" defaultValue={str('store.gstin')} /></label>
        </fieldset>
        {canBusiness && <div className="toolbar"><button className="btn">Save business information</button><Msg id="business" /></div>}
      </form>

      {/* ── Storefront ───────────────────────────────────── */}
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save('storefront', {
            'store.announcement': f.get('store.announcement'),
            'store.instagram': f.get('store.instagram'),
            'store.facebook': f.get('store.facebook'),
            'store.youtube': f.get('store.youtube'),
            'store.trustPoints': String(f.get('store.trustPoints') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
          });
        }}
      >
        <h2>Storefront</h2>
        <fieldset disabled={!canBusiness} style={{ border: 0, padding: 0, margin: 0 }} className="form">
          <label className="field">Announcement bar <small className="muted">(leave empty to hide)</small><input className="input" name="store.announcement" maxLength={160} defaultValue={str('store.announcement')} /></label>
          <div className="form-grid">
            <label className="field">Instagram URL<input className="input" name="store.instagram" defaultValue={str('store.instagram')} /></label>
            <label className="field">Facebook URL<input className="input" name="store.facebook" defaultValue={str('store.facebook')} /></label>
            <label className="field">YouTube URL<input className="input" name="store.youtube" defaultValue={str('store.youtube')} /></label>
          </div>
          <label className="field">
            Trust messages <small className="muted">(one per line, up to 6 — only publish claims your policies and operations support)</small>
            <textarea name="store.trustPoints" rows={5} defaultValue={((v['store.trustPoints'] as string[]) ?? []).join('\n')} />
          </label>
        </fieldset>
        {canBusiness && <div className="toolbar"><button className="btn">Save storefront</button><Msg id="storefront" /></div>}
      </form>

      {/* ── Shipping, checkout, returns ──────────────────── */}
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save('checkout', {
            'shipping.flatRate': toPaise(f.get('shipping.flatRate')),
            'shipping.freeAbove': toPaise(f.get('shipping.freeAbove')),
            'checkout.codEnabled': f.get('checkout.codEnabled') === 'on',
            'checkout.pendingOrderTtlMinutes': Number(f.get('checkout.pendingOrderTtlMinutes')),
            'checkout.manualPaymentHoldHours': Number(f.get('checkout.manualPaymentHoldHours')),
            'returns.windowDays': Number(f.get('returns.windowDays')),
          });
        }}
      >
        <h2>Shipping, checkout &amp; returns</h2>
        <fieldset disabled={!canBusiness} style={{ border: 0, padding: 0, margin: 0 }} className="form">
          <div className="form-grid">
            <label className="field">Flat delivery charge (₹)<input className="input" type="number" min="0" step="0.01" name="shipping.flatRate" defaultValue={rupees(v['shipping.flatRate'])} /></label>
            <label className="field">Free delivery above (₹, 0 = always free)<input className="input" type="number" min="0" step="0.01" name="shipping.freeAbove" defaultValue={rupees(v['shipping.freeAbove'])} /></label>
            <label className="field">Gateway payment hold (minutes)<input className="input" type="number" min="5" name="checkout.pendingOrderTtlMinutes" defaultValue={str('checkout.pendingOrderTtlMinutes')} /></label>
            <label className="field">UPI / bank transfer hold (hours)<input className="input" type="number" min="1" name="checkout.manualPaymentHoldHours" defaultValue={str('checkout.manualPaymentHoldHours')} /></label>
            <label className="field">Return window (days after delivery, 0 = no returns)<input className="input" type="number" min="0" name="returns.windowDays" defaultValue={str('returns.windowDays')} /></label>
          </div>
          <label className="check"><input type="checkbox" name="checkout.codEnabled" defaultChecked={Boolean(v['checkout.codEnabled'])} /> Allow cash on delivery</label>
        </fieldset>
        {canBusiness && <div className="toolbar"><button className="btn">Save shipping &amp; checkout</button><Msg id="checkout" /></div>}
      </form>

      {/* ── Payment information ──────────────────────────── */}
      <form
        key={formKey}
        className="panel form"
        aria-labelledby="payment-info"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save(
            'payment',
            {
              'payments.enabledProviders': f.getAll('payments.enabledProviders'),
              'payments.bankName': f.get('payments.bankName'),
              'payments.bankAccountName': f.get('payments.bankAccountName'),
              'payments.bankAccountNumber': String(f.get('payments.bankAccountNumber') ?? '').replace(/\s/g, ''),
              'payments.bankIfsc': String(f.get('payments.bankIfsc') ?? '').trim().toUpperCase(),
              'payments.bankBranch': f.get('payments.bankBranch'),
              'payments.bankInstructions': f.get('payments.bankInstructions'),
              'payments.upiId': String(f.get('payments.upiId') ?? '').trim(),
              'payments.upiPayeeName': f.get('payments.upiPayeeName'),
              'payments.upiInstructions': f.get('payments.upiInstructions'),
              'payments.upiGeneratedQrEnabled': f.get('payments.upiGeneratedQrEnabled') === 'on',
              'payments.refundInstructions': f.get('payments.refundInstructions'),
            },
            true,
          );
        }}
      >
        <div className="section-title">
          <h2 id="payment-info">Payment information</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview((p) => !p)}>{preview ? 'Hide preview' : 'Preview customer view'}</button>
        </div>
        {!canPayment && <p className="notice">You can view payment information but not change it. Ask a Super Admin or Admin.</p>}
        <p className="muted" style={{ margin: 0 }}>
          Shown to customers only on their own order payment page. Changes require confirmation and are recorded in the change history.
        </p>

        <fieldset disabled={!canPayment} style={{ border: 0, padding: 0, margin: 0 }} className="form">
          <h3>Payment methods</h3>
          <div className="toolbar">
            {PROVIDERS.map(([p, label]) => (
              <label key={p} className="check"><input type="checkbox" name="payments.enabledProviders" value={p} defaultChecked={enabled.includes(p)} /> {label}</label>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>Gateways stay unavailable until their API keys are configured on the server.</p>

          <h3>Bank account (bank transfer)</h3>
          <div className="form-grid">
            <label className="field">Bank name<Updated k="payments.bankName" /><input className="input" name="payments.bankName" defaultValue={str('payments.bankName')} /></label>
            <label className="field">Account holder<Updated k="payments.bankAccountName" /><input className="input" name="payments.bankAccountName" defaultValue={str('payments.bankAccountName')} /></label>
            <label className="field">
              Account number<Updated k="payments.bankAccountNumber" />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" name="payments.bankAccountNumber" defaultValue={revealed ?? str('payments.bankAccountNumber')} autoComplete="off" inputMode="numeric" />
                {canPayment && !revealed && <button type="button" className="btn btn-ghost btn-sm" onClick={reveal}>Reveal</button>}
              </div>
              <small className="muted">Masked for privacy. Revealing is logged. Type a new number to change it.</small>
            </label>
            <label className="field">IFSC<Updated k="payments.bankIfsc" /><input className="input" name="payments.bankIfsc" defaultValue={str('payments.bankIfsc')} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" /></label>
            <label className="field">Branch<input className="input" name="payments.bankBranch" defaultValue={str('payments.bankBranch')} /></label>
          </div>
          <label className="field">Bank transfer instructions <small className="muted">(optional, shown to the customer)</small><textarea name="payments.bankInstructions" rows={3} defaultValue={str('payments.bankInstructions')} /></label>

          <h3>UPI</h3>
          <div className="form-grid">
            <label className="field">UPI ID<Updated k="payments.upiId" /><input className="input" name="payments.upiId" defaultValue={str('payments.upiId')} placeholder="name@bank" /></label>
            <label className="field">Payee name<input className="input" name="payments.upiPayeeName" defaultValue={str('payments.upiPayeeName')} /></label>
          </div>
          <label className="field">UPI payment instructions <small className="muted">(optional)</small><textarea name="payments.upiInstructions" rows={3} defaultValue={str('payments.upiInstructions')} /></label>
          <label className="check">
            <input type="checkbox" name="payments.upiGeneratedQrEnabled" defaultChecked={Boolean(v['payments.upiGeneratedQrEnabled'])} />
            Also offer an “Open UPI app” link with the amount pre-filled (enable only after testing it pays the right account)
          </label>

          <h3>Refunds</h3>
          <label className="field">Refund processing instructions <small className="muted">(internal guidance / customer policy summary)</small><textarea name="payments.refundInstructions" rows={3} defaultValue={str('payments.refundInstructions')} /></label>
        </fieldset>

        {preview && (
          <div className="notice" aria-label="Customer preview">
            <strong>Customer sees (bank transfer):</strong>
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Bank</dt><dd>{str('payments.bankName')}</dd>
              <dt>Account holder</dt><dd>{str('payments.bankAccountName')}</dd>
              <dt>Account number</dt><dd>{revealed ?? 'full number (masked here)'}</dd>
              <dt>IFSC</dt><dd>{str('payments.bankIfsc')}</dd>
              <dt>Branch</dt><dd>{str('payments.bankBranch') || '—'}</dd>
              <dt>Reference</dt><dd>their order number</dd>
            </dl>
            <strong style={{ display: 'block', marginTop: 12 }}>Customer sees (UPI):</strong>
            <p style={{ margin: '6px 0 0' }}>{qr?.present && qr.matchesUpiId ? 'The verified QR below' : 'No QR (UPI ID only)'} · UPI ID {str('payments.upiId')} · Name {str('payments.upiPayeeName')}</p>
          </div>
        )}
        {canPayment && (
          <div className="toolbar">
            <button className="btn">Save payment information</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setRevealed(null); setFormKey((k) => k + 1); }}>Cancel changes</button>
            <Msg id="payment" />
          </div>
        )}
      </form>

      {/* ── UPI QR ───────────────────────────────────────── */}
      <section className="panel form" aria-labelledby="upi-qr">
        <div className="section-title">
          <h2 id="upi-qr">UPI QR code</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => load()}>Validate again</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Upload the original QR from your UPI app. It is decoded on the server and accepted only if it pays the UPI ID above. The image is stored unmodified and shown only on customers’ own payment pages.
        </p>
        {qr?.present ? (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr-preview" src={qr.dataUrl} alt="Current UPI QR" />
            <dl className="kv">
              <dt>Pays UPI ID</dt><dd>{qr.decoded?.upiId ?? 'unreadable'}</dd>
              <dt>Payee name in QR</dt><dd>{qr.decoded?.payeeName ?? '—'}</dd>
              <dt>Account type</dt><dd>{qr.decoded?.merchantCode && qr.decoded.merchantCode !== '0000' ? `Merchant (${qr.decoded.merchantCode})` : 'Personal (P2P)'}</dd>
              <dt>Validation</dt>
              <dd>{qr.matchesUpiId ? <span className="badge ok">Matches UPI ID setting</span> : <span className="badge bad">Does NOT match UPI ID — hidden from customers</span>}</dd>
              <dt>Uploaded</dt><dd>{qr.updatedAt ? formatDate(qr.updatedAt) : '—'} by {qr.uploadedBy ?? '—'}</dd>
              <dt>Fingerprint</dt><dd style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{qr.sha256?.slice(0, 16)}…</dd>
            </dl>
          </div>
        ) : (
          <p className="notice">No QR uploaded. Customers paying by UPI see the UPI ID only.</p>
        )}
        {canPayment && (
          <div className="toolbar">
            <input ref={qrInput} type="file" accept="image/png,image/jpeg" aria-label="QR image file" />
            <button type="button" className="btn" onClick={uploadQr}>{qr?.present ? 'Replace QR' : 'Upload QR'}</button>
            {qr?.present && <button type="button" className="btn btn-danger" onClick={removeQr}>Remove QR</button>}
            <Msg id="qr" />
          </div>
        )}
      </section>

      {/* ── Change history ───────────────────────────────── */}
      <section className="panel" aria-labelledby="history">
        <h2 id="history">Change history</h2>
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Changes</th><th>IP</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.createdAt)}</td>
                    <td>{h.actorEmail ?? '—'}</td>
                    <td>{h.action.replace('settings.', '').replace(/[._]/g, ' ')}</td>
                    <td style={{ whiteSpace: 'normal', fontSize: '0.8rem' }}>
                      {h.after
                        ? Object.entries(h.after).map(([k, val]) => (
                            <div key={k}><strong>{k.replace(/^(payments|store)\./, '')}</strong>: {JSON.stringify(h.before?.[k] ?? null)} → {JSON.stringify(val)}</div>
                          ))
                        : '—'}
                    </td>
                    <td className="muted">{h.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No changes recorded yet.</p>
        )}
      </section>
    </>
  );
}
