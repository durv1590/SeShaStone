'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const PROVIDERS: [string, string][] = [
  ['UPI_DIRECT', 'UPI to store UPI ID'],
  ['BANK_TRANSFER', 'Bank transfer'],
  ['RAZORPAY', 'Razorpay'],
  ['CASHFREE', 'Cashfree'],
  ['UPI', 'UPI via gateway'],
];

export default function SettingsPage() {
  const { data, error, reload } = useApi<Record<string, unknown>>('/admin/settings');
  const [status, setStatus] = useState<string | null>(null);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rupees = (k: string) => Math.round(Number(f.get(k) || 0) * 100);
    try {
      await api('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          values: {
            'store.name': f.get('store.name'),
            'store.legalName': f.get('store.legalName'),
            'store.website': f.get('store.website'),
            'store.supportEmail': f.get('store.supportEmail'),
            'store.supportPhone': f.get('store.supportPhone'),
            'store.gstin': f.get('store.gstin'),
            'shipping.flatRate': rupees('shipping.flatRate'),
            'shipping.freeAbove': rupees('shipping.freeAbove'),
            'checkout.codEnabled': f.get('checkout.codEnabled') === 'on',
            'checkout.pendingOrderTtlMinutes': Number(f.get('checkout.pendingOrderTtlMinutes') || 30),
            'checkout.manualPaymentHoldHours': Number(f.get('checkout.manualPaymentHoldHours') || 48),
            'payments.enabledProviders': f.getAll('payments.enabledProviders'),
            'payments.upiId': String(f.get('payments.upiId') ?? '').trim(),
            'payments.upiPayeeName': f.get('payments.upiPayeeName'),
            'payments.bankName': f.get('payments.bankName'),
            'payments.bankAccountName': f.get('payments.bankAccountName'),
            'payments.bankAccountNumber': String(f.get('payments.bankAccountNumber') ?? '').replace(/\s/g, ''),
            'payments.bankIfsc': String(f.get('payments.bankIfsc') ?? '').trim().toUpperCase(),
          },
        }),
      });
      setStatus('Saved');
      await reload();
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return null;
  const str = (k: string) => String(data[k] ?? '');
  const rupees = (k: string) => String(Number(data[k] ?? 0) / 100);
  const enabled = (data['payments.enabledProviders'] as string[]) ?? [];

  return (
    <>
      <h1>Settings</h1>
      <form className="form" onSubmit={save}>
        <div className="panel form">
          <h2>Store</h2>
          <div className="form-grid">
            <label className="field">Store name<input className="input" name="store.name" defaultValue={str('store.name')} /></label>
            <label className="field">Company (legal name)<input className="input" name="store.legalName" defaultValue={str('store.legalName')} /></label>
            <label className="field">Website<input className="input" name="store.website" defaultValue={str('store.website')} /></label>
            <label className="field">Support email<input className="input" name="store.supportEmail" type="email" defaultValue={str('store.supportEmail')} /></label>
            <label className="field">Support phone<input className="input" name="store.supportPhone" defaultValue={str('store.supportPhone')} /></label>
            <label className="field">GSTIN<input className="input" name="store.gstin" defaultValue={str('store.gstin')} /></label>
          </div>
        </div>
        <div className="panel form">
          <h2>Shipping &amp; checkout</h2>
          <div className="form-grid">
            <label className="field">Flat shipping (₹)<input className="input" name="shipping.flatRate" type="number" min="0" defaultValue={rupees('shipping.flatRate')} /></label>
            <label className="field">Free shipping above (₹, 0 = always)<input className="input" name="shipping.freeAbove" type="number" min="0" defaultValue={rupees('shipping.freeAbove')} /></label>
            <label className="field">Unpaid gateway order hold (minutes)<input className="input" name="checkout.pendingOrderTtlMinutes" type="number" min="5" defaultValue={str('checkout.pendingOrderTtlMinutes')} /></label>
            <label className="field">UPI / bank transfer hold (hours)<input className="input" name="checkout.manualPaymentHoldHours" type="number" min="1" defaultValue={str('checkout.manualPaymentHoldHours')} /></label>
          </div>
          <label className="check"><input type="checkbox" name="checkout.codEnabled" defaultChecked={Boolean(data['checkout.codEnabled'])} /> Allow cash on delivery</label>
        </div>
        <div className="panel form">
          <h2>Payment methods</h2>
          <div className="toolbar">
            {PROVIDERS.map(([p, label]) => (
              <label key={p} className="check">
                <input type="checkbox" name="payments.enabledProviders" value={p} defaultChecked={enabled.includes(p)} /> {label}
              </label>
            ))}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            UPI-to-ID and bank transfers are confirmed by you under Payments once the money arrives. Razorpay / Cashfree keys
            are configured in the API environment.
          </p>
          <div className="form-grid">
            <label className="field">UPI ID<input className="input" name="payments.upiId" defaultValue={str('payments.upiId')} placeholder="name@bank" /></label>
            <label className="field">UPI payee name<input className="input" name="payments.upiPayeeName" defaultValue={str('payments.upiPayeeName')} /></label>
            <label className="field">Bank name<input className="input" name="payments.bankName" defaultValue={str('payments.bankName')} /></label>
            <label className="field">Account holder name<input className="input" name="payments.bankAccountName" defaultValue={str('payments.bankAccountName')} /></label>
            <label className="field">Account number<input className="input" name="payments.bankAccountNumber" defaultValue={str('payments.bankAccountNumber')} /></label>
            <label className="field">IFSC<input className="input" name="payments.bankIfsc" defaultValue={str('payments.bankIfsc')} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" /></label>
          </div>
        </div>
        <div className="toolbar">
          <button className="btn">Save settings</button>
          {status && <span className="muted">{status}</span>}
        </div>
      </form>
    </>
  );
}
