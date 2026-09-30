'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { api } from '@/lib/api';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) return setError('Passwords do not match');
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: f.get('password') }) });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (done) return <p className="notice notice--success" role="status">Your password has been updated. <Link className="link" href="/login">Sign in</Link></p>;
  if (!token) return <p className="notice notice--error">This reset link is incomplete. <Link className="link" href="/forgot-password">Request a new one</Link>.</p>;
  return (
    <form className="form" onSubmit={submit}>
      <label className="field">New password<input className="input" name="password" type="password" required minLength={8} autoComplete="new-password" /><small>At least 8 characters, including a letter and a number.</small></label>
      <label className="field">Confirm password<input className="input" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn--block">Update password</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 16 }}>Choose a new password</h1>
      <Suspense><ResetForm /></Suspense>
    </div>
  );
}
