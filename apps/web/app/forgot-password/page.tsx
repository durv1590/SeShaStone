'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: new FormData(e.currentTarget).get('email') }) });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="container section" style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 16 }}>Reset your password</h1>
      {sent ? (
        <p className="notice notice--success" role="status">
          If an account exists for that email, we have sent a link to reset your password. It expires in 30 minutes.
        </p>
      ) : (
        <form className="form" onSubmit={submit}>
          <label className="field">Email<input className="input" name="email" type="email" required autoComplete="email" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn--block">Send reset link</button>
        </form>
      )}
      <p style={{ marginTop: 20 }}><Link className="link muted" href="/login">Back to sign in</Link></p>
    </div>
  );
}
