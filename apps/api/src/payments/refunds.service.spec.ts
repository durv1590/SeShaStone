import { refundableAmount } from './refunds.service';

describe('refundableAmount', () => {
  it('only counts money actually received', () => {
    expect(refundableAmount([{ status: 'PENDING', amount: 1000 }, { status: 'SUBMITTED', amount: 1000 }], [])).toBe(0);
    expect(refundableAmount([{ status: 'CAPTURED', amount: 1000 }], [])).toBe(1000);
  });

  it('subtracts pending and processed refunds but not failed ones', () => {
    const payments = [{ status: 'PARTIALLY_REFUNDED', amount: 10_000 }];
    const refunds = [
      { status: 'PROCESSED', amount: 3_000 },
      { status: 'PENDING', amount: 2_000 },
      { status: 'FAILED', amount: 5_000 },
    ];
    expect(refundableAmount(payments, refunds)).toBe(5_000);
  });

  it('never goes negative', () => {
    expect(refundableAmount([{ status: 'CAPTURED', amount: 100 }], [{ status: 'PROCESSED', amount: 500 }])).toBe(0);
  });
});
