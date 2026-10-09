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

/** Only allow same-site redirects after login (prevents open-redirects via ?next=). */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/account');

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { setSession } = useStore();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (!form.phone) delete form.phone;
    if (!form.lastName) delete form.lastName;
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
    <div className="container section" style={{ maxWidth: 520 }}>
      <p className="eyebrow">SeSha Stone</p>
      <h1 style={{ marginBottom: 24 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form className="form" onSubmit={onSubmit} noValidate={false}>
        {mode === 'register' && (
          <div className="form-grid">
            <label className="field">First name<input className="input" name="firstName" required autoComplete="given-name" /></label>
            <label className="field">Last name <small>(optional)</small><input className="input" name="lastName" autoComplete="family-name" /></label>
          </div>
        )}
        <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email" /></label>
        {mode === 'register' && (
          <label className="field">Mobile <small>(optional)</small><input className="input" name="phone" placeholder="+91" autoComplete="tel" inputMode="tel" /></label>
        )}
        <label className="field">
          Password
          <input
            className="input"
            name="password"
            type="password"
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            aria-describedby={mode === 'register' ? 'pw-hint' : undefined}
          />
          {mode === 'register' && <small id="pw-hint">At least 8 characters, including a letter and a number.</small>}
        </label>
        {error && <p className="notice notice--error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn--block" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          {mode === 'login' ? (
            <>
              <Link className="link" href="/forgot-password">Forgot password?</Link> · New to SeSha Stone?{' '}
              <Link className="link" href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
            </>
          ) : (
            <>Already have an account? <Link className="link" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
