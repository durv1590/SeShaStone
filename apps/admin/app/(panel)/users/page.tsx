'use client';

import { FormEvent, useState } from 'react';
import { useSession } from '@/components/session';
import { formatDate } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Staff { id: string; email: string; firstName: string; lastName: string | null; role: string; isActive: boolean; lastLoginAt: string | null }
interface RoleInfo { role: string; permissions: string[] }

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  ORDER_MANAGER: 'Order Manager',
  PRODUCT_MANAGER: 'Product Manager',
  MARKETING_MANAGER: 'Marketing Manager',
  SUPPORT: 'Customer Support',
  STAFF: 'Staff (legacy)',
};

export default function UsersPage() {
  const { me } = useSession();
  const users = useApi<Staff[]>('/admin/users');
  const roles = useApi<RoleInfo[]>('/admin/users/roles');
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    try {
      await api('/admin/users', { method: 'POST', body: JSON.stringify({ ...f, lastName: f.lastName || undefined }) });
      form.reset();
      setError(null);
      await users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(u: Staff, change: Partial<Pick<Staff, 'role' | 'isActive'>>) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(change) });
      setError(null);
      await users.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <>
      <h1>Staff &amp; roles</h1>
      {error && <p className="notice bad" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Access</th></tr></thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} disabled={u.id === me?.id} onChange={(e) => update(u, { role: e.target.value })} aria-label={`Role for ${u.email}`}>
                    {Object.entries(ROLE_LABEL).map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                  </select>
                </td>
                <td>{formatDate(u.lastLoginAt)}</td>
                <td>
                  {u.id === me?.id ? <span className="muted">You</span> : (
                    <button className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-ghost'}`} onClick={() => confirm(`${u.isActive ? 'Disable' : 'Enable'} ${u.email}?`) && update(u, { isActive: !u.isActive })}>
                      {u.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel form" onSubmit={create} style={{ marginTop: 20 }}>
        <h2>Add staff member</h2>
        <div className="form-grid">
          <label className="field">First name<input className="input" name="firstName" required /></label>
          <label className="field">Last name<input className="input" name="lastName" /></label>
          <label className="field">Email<input className="input" type="email" name="email" required /></label>
          <label className="field">Role
            <select name="role" defaultValue="SUPPORT">
              {Object.entries(ROLE_LABEL).filter(([r]) => r !== 'STAFF').map(([r, l]) => <option key={r} value={r}>{l}</option>)}
            </select>
          </label>
          <label className="field">Temporary password<input className="input" type="password" name="password" required minLength={10} autoComplete="new-password" /><small className="muted">10+ characters with a letter and a number. Ask them to change it via “Forgot password”.</small></label>
        </div>
        <div><button className="btn">Add staff member</button></div>
      </form>

      <div className="panel" style={{ marginTop: 20 }}>
        <h2>What each role can do</h2>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {roles.data?.map((r) => (
                <tr key={r.role}>
                  <td style={{ fontWeight: 600 }}>{ROLE_LABEL[r.role] ?? r.role}</td>
                  <td style={{ whiteSpace: 'normal', fontSize: '0.82rem' }}>{r.permissions.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
