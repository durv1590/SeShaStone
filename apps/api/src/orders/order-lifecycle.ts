import { OrderStatus, PaymentProvider } from '@prisma/client';

/** Payment methods confirmed by an admin rather than a gateway callback. */
export const MANUAL_PROVIDERS: PaymentProvider[] = [PaymentProvider.UPI_DIRECT, PaymentProvider.BANK_TRANSFER];

/**
 * Admin-driven order status transitions.
 *   New (PENDING_PAYMENT) → Confirmed (PAID) → Processing → Packed → Shipped → Out for delivery → Delivered
 *   Delivered → Return requested → Returned | back to Delivered (return rejected)
 * PAID is set by payment capture/verification, and REFUNDED by the refunds module — never directly.
 */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'PACKED', 'CANCELLED'],
  PROCESSING: ['PACKED', 'SHIPPED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  RETURNED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Statuses in which money has been received and not (fully) returned. */
export const PAID_STATUSES: OrderStatus[] = [
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURN_REQUESTED',
  'RETURNED',
];

/** Statuses in which stock has already been sold (committed) rather than just reserved. */
export const STOCK_COMMITTED_STATUSES: OrderStatus[] = ['PAID', 'PROCESSING', 'PACKED'];

/** Merges duplicate variant lines so each variant is reserved once. */
export function toStockLines(items: { variantId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of items) merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Server-side pricing of GST-inclusive lines. Integer paise throughout. */
export function priceLines(
  lines: { variantId: string; quantity: number; unitPrice: number; gstRate: number }[],
) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const lineTotal = l.unitPrice * l.quantity;
    subtotal += lineTotal;
    tax += Math.round((lineTotal * l.gstRate) / (100 + l.gstRate));
  }
  return { subtotal, tax };
}

export function shippingFor(amountAfterDiscount: number, flatRate: number, freeAbove: number) {
  return freeAbove > 0 && amountAfterDiscount >= freeAbove ? 0 : flatRate;
}
