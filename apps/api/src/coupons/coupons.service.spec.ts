import { Coupon } from '@prisma/client';
import { computeDiscount } from './coupons.service';

const base: Coupon = {
  id: 'c1',
  code: 'TEST',
  description: null,
  type: 'PERCENTAGE',
  value: 10,
  minOrderValue: 0,
  maxDiscount: null,
  usageLimit: null,
  perCustomerLimit: 1,
  usedCount: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('computeDiscount', () => {
  it('applies a percentage discount', () => {
    expect(computeDiscount(base, 100_000)).toBe(10_000);
  });

  it('caps a percentage discount at maxDiscount', () => {
    expect(computeDiscount({ ...base, maxDiscount: 5_000 }, 100_000)).toBe(5_000);
  });

  it('applies a fixed discount', () => {
    expect(computeDiscount({ ...base, type: 'FIXED', value: 50_000 }, 200_000)).toBe(50_000);
  });

  it('never discounts more than the subtotal', () => {
    expect(computeDiscount({ ...base, type: 'FIXED', value: 50_000 }, 20_000)).toBe(20_000);
  });
});
