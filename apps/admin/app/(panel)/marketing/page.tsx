'use client';

import { FormEvent, useState } from 'react';
import { api, Paginated } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { formatDate, Pager, StatusBadge } from '@/components/ui';

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  subscribedAt: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
}

export default function MarketingPage() {
  const [page, setPage] = useState(1);
  const subscribers = useApi<Paginated<Subscriber>>(`/admin/marketing/subscribers?page=${page}`);
  const campaigns = useApi<Campaign[]>('/admin/marketing/campaigns');
  const [error, setError] = useState<string | null>(null);

  async function createCampaign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    try {
      await api('/admin/marketing/campaigns', {
        method: 'POST',
        body: JSON.stringify({ ...f, scheduledAt: f.scheduledAt || undefined }),
      });
      form.reset();
      setError(null);
      await campaigns.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function cancel(id: string) {
    await api(`/admin/marketing/campaigns/${id}/cancel`, { method: 'POST' });
    await campaigns.reload();
  }

  return (
    <>
      <h1>Marketing</h1>
      <form className="panel form" onSubmit={createCampaign}>
        <h2>New email campaign</h2>
        <div className="form-grid">
          <input className="input" name="name" placeholder="Internal name" required />
          <input className="input" name="subject" placeholder="Email subject" required />
          <input className="input" name="scheduledAt" type="datetime-local" />
        </div>
        <textarea name="content" placeholder="Email content" required />
        {error && <p className="error">{error}</p>}
        <div><button className="btn">Save campaign</button></div>
      </form>

      <div className="panel">
        <h2>Campaigns</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Subject</th><th>Status</th><th>Scheduled</th><th /></tr></thead>
            <tbody>
              {campaigns.data?.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{formatDate(c.scheduledAt)}</td>
                  <td>
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancel(c.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>Newsletter subscribers {subscribers.data && <span className="muted">({subscribers.data.total})</span>}</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Email</th><th>Source</th><th>Subscribed</th></tr></thead>
            <tbody>
              {subscribers.data?.items.map((s) => (
                <tr key={s.id}><td>{s.email}</td><td>{s.source ?? '—'}</td><td>{formatDate(s.subscribedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {subscribers.data && <Pager page={subscribers.data.page} totalPages={subscribers.data.totalPages} onPage={setPage} />}
      </div>
    </>
  );
}
