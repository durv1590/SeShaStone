export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: rest.cache ?? 'no-store',
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(res.status, message ?? res.statusText);
  }
  return body as T;
}

// ── Shared response types ──────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  children: Category[];
}

export interface ProductImage {
  url: string;
  alt: string | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  metal: string | null;
  purity: string | null;
  gemstone: string | null;
  images: ProductImage[];
  minPrice: number;
  maxPrice: number;
  variants: { compareAtPrice: number | null }[];
}

export interface Variant {
  id: string;
  sku: string;
  title: string;
  size: string | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
}

export interface ProductDetail extends Omit<ProductSummary, 'variants' | 'minPrice' | 'maxPrice'> {
  description: string | null;
  isCertified: boolean;
  category: { name: string; slug: string } | null;
  variants: Variant[];
  rating: { average: number | null; count: number };
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  placedAt: string;
  items: { id: string; productName: string; quantity: number; lineTotal: number }[];
}
