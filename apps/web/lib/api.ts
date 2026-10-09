export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

type ApiInit = RequestInit & { token?: string | null; revalidate?: number };

/**
 * Fetch wrapper for the NestJS API. Server components may pass `revalidate` to cache public,
 * rarely-changing data (settings, categories); everything else is fetched fresh.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { token, headers, revalidate, ...rest } = init;
  const isForm = typeof FormData !== 'undefined' && rest.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache: rest.cache ?? 'no-store' }),
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new ApiError(res.status, message ?? res.statusText, body);
  }
  return body as T;
}

// ── Shared response types ──────────────────────────────────

export type JewelleryLine = 'GOLD' | 'SILVER' | 'DIAMOND' | 'ARTIFICIAL';

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

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroImageUrl: string | null;
  theme: string | null;
  rule: 'MANUAL' | 'NEWEST' | 'BESTSELLING';
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ProductImage {
  url: string;
  alt: string | null;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  line: JewelleryLine | null;
  metal: string | null;
  purity: string | null;
  gemstone: string | null;
  images: ProductImage[];
  minPrice: number;
  maxPrice: number;
  variants: { compareAtPrice: number | null; price: number }[];
  category: { name: string; slug: string } | null;
}

export interface Variant {
  id: string;
  sku: string;
  title: string;
  size: string | null;
  weightGrams: string | null;
  netWeightGrams: string | null;
  price: number;
  compareAtPrice: number | null;
  inStock: boolean;
}

export interface ProductDetail extends Omit<ProductSummary, 'variants' | 'minPrice' | 'maxPrice'> {
  description: string | null;
  isCertified: boolean;
  certificateUrl: string | null;
  certificateNumber: string | null;
  hallmarkId: string | null;
  finish: string | null;
  baseMaterial: string | null;
  plating: string | null;
  stoneType: string | null;
  diamondCarat: string | null;
  diamondCut: string | null;
  diamondColour: string | null;
  diamondClarity: string | null;
  dimensions: string | null;
  careInstructions: string | null;
  shippingInfo: string | null;
  isReturnEligible: boolean;
  videoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  collections: { id: string; name: string; slug: string }[];
  variants: Variant[];
  rating: { average: number | null; count: number };
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
  customer: { firstName: string };
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  tabletImageUrl: string | null;
  mobileImageUrl: string | null;
  ctaLabel: string | null;
  linkUrl: string | null;
  theme: string | null;
}

export interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

export interface OrderPayment {
  id: string;
  provider: string;
  status: string;
  amount: number;
  providerPaymentId: string | null;
  rejectionReason: string | null;
  refundedAmount: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  courier: string | null;
  couponCode: string | null;
  shippingAddress: Record<string, string | null>;
  items: { id: string; productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }[];
  payments?: OrderPayment[];
  refunds?: { id: string; amount: number; status: string; reference: string | null; processedAt: string | null }[];
  returnRequests?: { id: string; reason: string; status: string; adminNote: string | null }[];
  returnEligibleUntil?: string | null;
}

export interface StoreSettings {
  'store.name': string;
  'store.legalName': string;
  'store.website': string;
  'store.supportEmail': string;
  'store.supportPhone': string;
  'store.whatsapp': string;
  'store.address': string;
  'store.announcement': string;
  'store.instagram': string;
  'store.facebook': string;
  'store.youtube': string;
  'store.trustPoints': string[];
  'shipping.flatRate': number;
  'shipping.freeAbove': number;
  'checkout.codEnabled': boolean;
  'returns.windowDays': number;
  'payments.enabledProviders': string[];
}

export const DEFAULT_SETTINGS: StoreSettings = {
  'store.name': 'SeSha Stone',
  'store.legalName': 'SeSha Stone Pvt. Ltd.',
  'store.website': 'www.seshastone.com',
  'store.supportEmail': '',
  'store.supportPhone': '',
  'store.whatsapp': '',
  'store.address': '',
  'store.announcement': '',
  'store.instagram': '',
  'store.facebook': '',
  'store.youtube': '',
  'store.trustPoints': [],
  'shipping.flatRate': 0,
  'shipping.freeAbove': 0,
  'checkout.codEnabled': false,
  'returns.windowDays': 0,
  'payments.enabledProviders': [],
};

/** Public business settings (cached 60 s). Falls back to defaults if the API is unreachable. */
export async function getSettings(): Promise<StoreSettings> {
  try {
    return { ...DEFAULT_SETTINGS, ...(await api<Partial<StoreSettings>>('/settings', { revalidate: 60 })) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface PaymentInstructions {
  provider: 'UPI_DIRECT' | 'BANK_TRANSFER';
  paymentId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  amount: number;
  reference: string;
  submittedReference: string | null;
  submittedAt: string | null;
  rejectionReason: string | null;
  message: string | null;
  evidence: { id: string; fileName: string; mimeType: string; size: number; uploadedAt: string }[];
  upi?: { upiId: string; payeeName: string; qrImage: string | null; intentUri: string | null; instructions: string | null };
  bank?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    ifsc: string;
    branch: string | null;
    instructions: string | null;
  };
}
