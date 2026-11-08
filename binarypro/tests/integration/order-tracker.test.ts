import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { createOrder, markDelivered, verifyOrder, returnOrder } from '@/lib/server/orders';
import { handleCapturedEvent } from '@/lib/server/payments';
import { createCoupon, fundCouponPool } from '@/lib/server/coupons';
import { orderTracker } from '@/lib/server/order-tracker';
import { addDays } from '@/lib/server/time';
import { dateRange } from '@/lib/domain/finance';
import { assertLedgerBalanced, makeMerchantWithProduct, makeUser, resetDb } from './helpers';

const DAY = 86_400_000;
const todayRange = (() => {
  const d = new Date().toISOString().slice(0, 10);
  return dateRange(d, d)!;
})();

async function payOrder(orderId: string) {
  const payment = await db.payment.findFirstOrThrow({ where: { referenceId: orderId, kind: 'ORDER' } });
  return handleCapturedEvent({
    id: `evt_${orderId}`,
    type: 'payment.captured',
    providerRef: payment.providerRef,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
  });
}

describe('order tracker', () => {
  beforeEach(resetDb);

  it('moves an order through its buckets and reports refunds and commission eligibility', async () => {
    const buyer = await makeUser({ name: 'Buyer', kyc: 'VERIFIED' });
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const coupon = await createCoupon({
      code: 'TRACK10', funding: 'MERCHANT', merchantId: merchant.id, percent: 10,
      maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 200_000n, perUserLimit: 5,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 200_000n, 'test');

    const order = await createOrder(buyer.id, [{ productId: product.id, quantity: 1 }], 'TRACK10');
    let report = await orderTracker(todayRange, new Date());
    expect(report.rows[0]!.bucket).toBe('AWAITING_PAYMENT');

    await payOrder(order.id);
    report = await orderTracker(todayRange, new Date());
    expect(report.rows[0]!.bucket).toBe('IN_TRANSIT');

    await markDelivered(order.id, 'test');
    const windowEnds = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).returnWindowEndsAt!;
    report = await orderTracker(todayRange, new Date());
    expect(report.rows[0]!.bucket).toBe('RETURN_WINDOW_OPEN');
    expect(report.counts.RETURN_WINDOW_OPEN).toBe(1);

    const afterWindow = new Date(windowEnds.getTime() + 1000);
    report = await orderTracker(todayRange, afterWindow);
    expect(report.rows[0]!.bucket).toBe('READY_TO_VERIFY');

    await verifyOrder(order.id, 'test', afterWindow);
    report = await orderTracker(todayRange, afterWindow);
    const row = report.rows[0]!;
    expect(row.bucket).toBe('COMMISSION_ELIGIBLE');
    expect(row.commissionEligible).toBe(true);
    expect(row.pvInrMinor).toBe(100_000n);
    expect(row.commissionPostedMinor).toBe(0n); // buyer has no sponsor, so no direct commission posts
    expect(report.byCurrency).toEqual([expect.objectContaining({ currency: 'INR', orders: 1, subtotalMinor: 100_000n, refundsMinor: 0n })]);

    await returnOrder(order.id, 'test', afterWindow);
    report = await orderTracker(todayRange, afterWindow);
    expect(report.rows[0]!.bucket).toBe('RETURNED');
    expect(report.rows[0]!.commissionEligible).toBe(false);
    expect(report.byCurrency[0]!.refundsMinor).toBe(100_000n);

    await assertLedgerBalanced();
  });
});
