import { canTransition, priceLines, shippingFor, toStockLines, TRANSITIONS } from './order-lifecycle';

describe('order lifecycle', () => {
  it('follows the fulfilment path', () => {
    const path = ['PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i], path[i + 1])).toBe(true);
  });

  it('never lets an admin mark an order paid or refunded directly', () => {
    for (const targets of Object.values(TRANSITIONS)) {
      expect(targets).not.toContain('PAID');
      expect(targets).not.toContain('REFUNDED');
    }
  });

  it('blocks cancelling after dispatch and skipping steps backwards', () => {
    expect(canTransition('SHIPPED', 'CANCELLED')).toBe(false);
    expect(canTransition('DELIVERED', 'SHIPPED')).toBe(false);
    expect(canTransition('PENDING_PAYMENT', 'SHIPPED')).toBe(false);
  });

  it('supports the return flow', () => {
    expect(canTransition('DELIVERED', 'RETURN_REQUESTED')).toBe(true);
    expect(canTransition('RETURN_REQUESTED', 'RETURNED')).toBe(true);
    expect(canTransition('RETURN_REQUESTED', 'DELIVERED')).toBe(true);
  });
});

describe('pricing', () => {
  it('extracts GST from inclusive prices in integer paise', () => {
    const { subtotal, tax } = priceLines([{ variantId: 'a', quantity: 2, unitPrice: 103_000, gstRate: 3 }]);
    expect(subtotal).toBe(206_000);
    expect(tax).toBe(6_000);
    expect(Number.isInteger(tax)).toBe(true);
  });

  it('applies free shipping above the threshold only', () => {
    expect(shippingFor(5_000_000, 10_000, 5_000_000)).toBe(0);
    expect(shippingFor(4_999_999, 10_000, 5_000_000)).toBe(10_000);
    expect(shippingFor(1, 10_000, 0)).toBe(10_000);
  });

  it('merges duplicate cart lines before reserving stock', () => {
    expect(toStockLines([{ variantId: 'v', quantity: 1 }, { variantId: 'v', quantity: 2 }])).toEqual([
      { variantId: 'v', quantity: 3 },
    ]);
  });
});
