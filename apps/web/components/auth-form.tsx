'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string; firstName: string };
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { setSession } = useStore();
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!form.phone) delete form.phone;
    try {
      const res = await api<AuthResponse>(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      setSession(res.accessToken, res.user);
      router.push(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container section">
      <h1 className="section-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form className="form" onSubmit={onSubmit}>
        {mode === 'register' && (
          <label className="field">First name<input className="input" name="firstName" required /></label>
        )}
        <label className="field">Email<input className="input" name="email" type="email" required /></label>
        {mode === 'register' && (
          <label className="field">Mobile (optional)<input className="input" name="phone" placeholder="+91" /></label>
        )}
        <label className="field">
          Password
          <input className="input" name="password" type="password" minLength={mode === 'register' ? 8 : 1} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{mode === 'login' ? 'Login' : 'Create account'}</button>
        <p className="muted">
          {mode === 'login' ? (
            <>New here? <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link></>
          ) : (
            <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`}>Login</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
