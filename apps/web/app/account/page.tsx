'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AccountShell } from '@/components/account-shell';
import { Address, api } from '@/lib/api';
import { useStore } from '@/lib/store';

interface Profile { email: string; firstName: string; lastName: string | null; phone: string | null; marketingOptIn: boolean }

export default function AccountPage() {
  const { token } = useStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setProfile(await api<Profile>('/me/profile', { token }));
    setAddresses(await api<Address[]>('/me/addresses', { token }));
  }, [token]);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, [load]);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await api('/me/profile', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          firstName: f.get('firstName'),
          lastName: f.get('lastName') || undefined,
          phone: f.get('phone') || undefined,
          marketingOptIn: f.get('marketingOptIn') === 'on',
        }),
      });
      setMsg('Profile saved');
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeAddress(id: string) {
    await api(`/me/addresses/${id}`, { method: 'DELETE', token });
    await load();
  }

  async function makeDefault(id: string) {
    await api(`/me/addresses/${id}`, { method: 'PATCH', token, body: JSON.stringify({ isDefault: true }) });
    await load();
  }

  return (
    <AccountShell title="My Account">
      <div className="stack" style={{ gap: 24 }}>
        {profile && (
          <form className="panel" onSubmit={saveProfile}>
            <h2>Profile</h2>
            <div className="form-grid">
              <label className="field">First name<input className="input" name="firstName" defaultValue={profile.firstName} required autoComplete="given-name" /></label>
              <label className="field">Last name<input className="input" name="lastName" defaultValue={profile.lastName ?? ''} autoComplete="family-name" /></label>
              <label className="field">Email<input className="input" value={profile.email} disabled /></label>
              <label className="field">Mobile<input className="input" name="phone" defaultValue={profile.phone ?? ''} placeholder="+91" autoComplete="tel" /></label>
            </div>
            <label className="check"><input type="checkbox" name="marketingOptIn" defaultChecked={profile.marketingOptIn} /> Email me about new collections and offers</label>
            <div><button className="btn">Save</button></div>
            {msg && <p className="notice notice--success" role="status" style={{ margin: 0 }}>{msg}</p>}
            {error && <p className="error" role="alert">{error}</p>}
          </form>
        )}
        <section className="panel" aria-labelledby="addr">
          <h2 id="addr">Saved addresses</h2>
          {addresses.length === 0 && <p className="muted">No saved addresses yet — add one at checkout.</p>}
          {addresses.map((a) => (
            <div key={a.id} className="radio-card" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>
                <strong>{a.fullName}</strong> · {a.phone} {a.isDefault && <span className="status status--ok">Default</span>}
                <br />
                <span className="muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}</span>
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {!a.isDefault && <button type="button" className="btn btn--outline btn--sm" onClick={() => makeDefault(a.id)}>Make default</button>}
                <button type="button" className="btn btn--outline btn--sm" onClick={() => removeAddress(a.id)}>Remove</button>
              </span>
            </div>
          ))}
        </section>
      </div>
    </AccountShell>
  );
}
