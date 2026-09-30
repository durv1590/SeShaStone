'use client';

import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';

export function NewsletterForm() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('busy');
    try {
      const email = String(new FormData(e.currentTarget).get('email'));
      await api('/newsletter/subscribe', { method: 'POST', body: JSON.stringify({ email, source: 'homepage' }) });
      setState('done');
    } catch {
      setState('error');
    }
  }
  if (state === 'done') return <p className="notice notice--success" role="status">Thank you — you’re on the list.</p>;
  return (
    <form onSubmit={submit} aria-label="Newsletter sign-up">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input id="nl-email" name="email" type="email" required className="input" placeholder="Your email address" autoComplete="email" />
      <button className="btn" disabled={state === 'busy'}>Subscribe</button>
      {state === 'error' && <p className="error" role="alert">Something went wrong. Please try again.</p>}
    </form>
  );
}
