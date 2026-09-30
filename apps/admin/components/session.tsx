'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  role: string;
  permissions: string[];
}

const SessionContext = createContext<{ me: Me | null; can: (p: string) => boolean }>({ me: null, can: () => false });

/** Loads the signed-in staff member and their permissions (the API enforces them regardless). */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (getToken()) api<Me>('/auth/me').then(setMe).catch(() => setMe(null));
  }, []);
  return (
    <SessionContext.Provider value={{ me, can: (p) => !!me?.permissions.includes(p) }}>{children}</SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
