'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
const TOKEN_KEY = 'sss.admin.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: { confirmationRequired?: boolean; keys?: string[]; decoded?: unknown; message?: unknown },
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Authenticated admin API call. A 401 clears the session and returns to the login screen. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...authHeaders(), ...init.headers },
  });
  const body = await res.json().catch(() => null);
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setToken(null);
    window.location.href = '/login';
  }
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(res.status, typeof message === 'string' ? message : res.statusText, body ?? undefined);
  }
  return body as T;
}

/** Opens a private file (e.g. payment evidence) in a new tab without exposing the token in a URL. */
export async function openPrivateFile(path: string) {
  const tab = window.open('', '_blank');
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    tab?.close();
    throw new ApiError(res.status, 'Could not open file');
  }
  const url = URL.createObjectURL(await res.blob());
  if (tab) tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}
