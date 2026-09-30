'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

const PROVIDERS = ['RAZORPAY', 'CASHFREE', 'UPI'];

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
            'store.supportEmail': f.get('store.supportEmail'),
            'store.supportPhone': f.get('store.supportPhone'),
            'store.gstin': f.get('store.gstin'),
            'shipping.flatRate': rupees('shipping.flatRate'),
            'shipping.freeAbove': rupees('shipping.freeAbove'),
            'checkout.codEnabled': f.get('checkout.codEnabled') === 'on',
            'checkout.pendingOrderTtlMinutes': Number(f.get('checkout.pendingOrderTtlMinutes') || 30),
            'payments.enabledProviders': f.getAll('payments.enabledProviders'),
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
            <label className="field">Unpaid order hold (minutes)<input className="input" name="checkout.pendingOrderTtlMinutes" type="number" min="5" defaultValue={str('checkout.pendingOrderTtlMinutes')} /></label>
          </div>
          <label className="check"><input type="checkbox" name="checkout.codEnabled" defaultChecked={Boolean(data['checkout.codEnabled'])} /> Allow cash on delivery</label>
        </div>
        <div className="panel form">
          <h2>Payment methods</h2>
          <p className="muted" style={{ margin: 0 }}>Gateway keys are configured in the API environment. UPI is collected through the default gateway.</p>
          <div className="toolbar">
            {PROVIDERS.map((p) => (
              <label key={p} className="check">
                <input type="checkbox" name="payments.enabledProviders" value={p} defaultChecked={enabled.includes(p)} /> {p}
              </label>
            ))}
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
