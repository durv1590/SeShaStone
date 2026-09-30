'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)));
      const res = await api<{ accessToken: string }>('/auth/admin/login', { method: 'POST', body });
      setToken(res.accessToken);
      router.replace('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="panel form" onSubmit={onSubmit}>
        <h1 style={{ marginBottom: 4 }}>Se Sha Stone</h1>
        <p className="muted" style={{ marginTop: 0 }}>Admin panel</p>
        <label className="field">Email<input className="input" name="email" type="email" required /></label>
        <label className="field">Password<input className="input" name="password" type="password" required /></label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>Sign in</button>
      </form>
    </div>
  );
}
