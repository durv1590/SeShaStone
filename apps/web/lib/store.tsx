'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface CartLine {
  variantId: string;
  productName: string;
  variantTitle: string;
  slug: string;
  imageUrl?: string;
  price: number;
  quantity: number;
}

interface User {
  id: string;
  email: string;
  firstName: string;
}

interface StoreState {
  token: string | null;
  user: User | null;
  cart: CartLine[];
  setSession: (token: string, user: User) => void;
  logout: () => void;
  addToCart: (line: CartLine) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
}

const StoreContext = createContext<StoreState | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setToken(load('sss.token', null));
    setUser(load('sss.user', null));
    setCart(load('sss.cart', []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save('sss.cart', cart);
  }, [cart, hydrated]);

  const setSession = useCallback((t: string, u: User) => {
    setToken(t);
    setUser(u);
    save('sss.token', t);
    save('sss.user', u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    save('sss.token', null);
    save('sss.user', null);
  }, []);

  const addToCart = useCallback((line: CartLine) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (!existing) return [...prev, line];
      return prev.map((l) =>
        l.variantId === line.variantId ? { ...l, quantity: Math.min(10, l.quantity + line.quantity) } : l,
      );
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(10, quantity) } : l)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const value = useMemo(
    () => ({ token, user, cart, setSession, logout, addToCart, updateQuantity, clearCart }),
    [token, user, cart, setSession, logout, addToCart, updateQuantity, clearCart],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
