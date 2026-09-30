'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { formatDate } from '@/components/ui';

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: number;
  minOrderValue: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  endsAt: string | null;
  isActive: boolean;
}

const paise = (rupees: string) => (rupees ? Math.round(Number(rupees) * 100) : undefined);

export default function CouponsPage() {
  const { data, error, reload } = useApi<Coupon[]>('/admin/coupons');
  const [formError, setFormError] = useState<string | null>(null);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: f.code.toUpperCase(),
          type: f.type,
          value: f.type === 'FIXED' ? paise(f.value) : Number(f.value),
          minOrderValue: paise(f.minOrderValue),
          maxDiscount: paise(f.maxDiscount),
          usageLimit: f.usageLimit ? Number(f.usageLimit) : undefined,
          endsAt: f.endsAt || undefined,
        }),
      });
      form.reset();
      setFormError(null);
      await reload();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function toggle(c: Coupon) {
    await api(`/admin/coupons/${c.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) });
    await reload();
  }

  return (
    <>
      <h1>Coupons</h1>
      <form className="panel form" onSubmit={create}>
        <h2>New coupon</h2>
        <div className="form-grid">
          <label className="field">Code<input className="input" name="code" required placeholder="DIWALI10" /></label>
          <label className="field">
            Type
            <select name="type"><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select>
          </label>
          <label className="field">Value (% or ₹)<input className="input" name="value" type="number" min="1" required /></label>
          <label className="field">Min order (₹)<input className="input" name="minOrderValue" type="number" min="0" /></label>
          <label className="field">Max discount (₹)<input className="input" name="maxDiscount" type="number" min="0" /></label>
          <label className="field">Total uses<input className="input" name="usageLimit" type="number" min="1" /></label>
          <label className="field">Expires<input className="input" name="endsAt" type="datetime-local" /></label>
        </div>
        {formError && <p className="error">{formError}</p>}
        <div><button className="btn">Create coupon</button></div>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Discount</th><th className="num">Min order</th><th className="num">Used</th><th>Expires</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>
                  {c.type === 'PERCENTAGE' ? `${c.value}%` : formatPrice(c.value)}
                  {c.maxDiscount != null && <span className="muted"> (max {formatPrice(c.maxDiscount)})</span>}
                </td>
                <td className="num">{formatPrice(c.minOrderValue)}</td>
                <td className="num">{c.usedCount}{c.usageLimit != null && ` / ${c.usageLimit}`}</td>
                <td>{formatDate(c.endsAt)}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(c)}>{c.isActive ? 'Active' : 'Disabled'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
