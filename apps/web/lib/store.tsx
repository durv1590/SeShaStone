'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

export interface CartLine {
  variantId: string;
  productName: string;
  variantTitle: string;
  slug: string;
  imageUrl?: string;
  /** Display only — the server always re-prices the cart at quote and checkout. */
  price: number;
  quantity: number;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
}

interface StoreState {
  hydrated: boolean;
  token: string | null;
  user: SessionUser | null;
  cart: CartLine[];
  wishlist: Set<string>;
  setSession: (token: string, user: SessionUser) => void;
  logout: () => void;
  addToCart: (line: CartLine) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  /** Returns false when the visitor must log in first. */
  toggleWishlist: (productId: string) => Promise<boolean>;
}

const StoreContext = createContext<StoreState | null>(null);
const MAX_QTY = 10;

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
    /* storage unavailable (private mode) — cart simply won't persist */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());

  useEffect(() => {
    setToken(load('sss.token', null));
    setUser(load('sss.user', null));
    setCart(load('sss.cart', []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) save('sss.cart', cart);
  }, [cart, hydrated]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setWishlist(new Set());
    save('sss.token', null);
    save('sss.user', null);
  }, []);

  // Keep wishlist ids in sync for heart icons; an expired token logs the visitor out.
  useEffect(() => {
    if (!token) return;
    api<{ productId: string }[]>('/me/wishlist', { token })
      .then((items) => setWishlist(new Set(items.map((i) => i.productId))))
      .catch((err) => {
        if (err?.status === 401) logout();
      });
  }, [token, logout]);

  const setSession = useCallback((t: string, u: SessionUser) => {
    setToken(t);
    setUser(u);
    save('sss.token', t);
    save('sss.user', u);
  }, []);

  const addToCart = useCallback((line: CartLine) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (!existing) return [...prev, { ...line, quantity: Math.min(MAX_QTY, line.quantity) }];
      return prev.map((l) =>
        l.variantId === line.variantId ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l,
      );
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!token) return false;
      const has = wishlist.has(productId);
      setWishlist((prev) => {
        const next = new Set(prev);
        if (has) next.delete(productId);
        else next.add(productId);
        return next;
      });
      try {
        if (has) await api(`/me/wishlist/${productId}`, { method: 'DELETE', token });
        else await api('/me/wishlist', { method: 'POST', token, body: JSON.stringify({ productId }) });
      } catch {
        // Roll back on failure.
        setWishlist((prev) => {
          const next = new Set(prev);
          if (has) next.add(productId);
          else next.delete(productId);
          return next;
        });
      }
      return true;
    },
    [token, wishlist],
  );

  const value = useMemo(
    () => ({ hydrated, token, user, cart, wishlist, setSession, logout, addToCart, updateQuantity, clearCart, toggleWishlist }),
    [hydrated, token, user, cart, wishlist, setSession, logout, addToCart, updateQuantity, clearCart, toggleWishlist],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
