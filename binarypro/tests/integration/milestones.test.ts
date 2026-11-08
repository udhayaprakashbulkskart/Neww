import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { createOrder, markDelivered, verifyOrder } from '@/lib/server/orders';
import { handleCapturedEvent } from '@/lib/server/payments';
import { createCoupon, fundCouponPool } from '@/lib/server/coupons';
import { addDays } from '@/lib/server/time';
import { evaluateMilestones, decideAward, memberMilestone, updateRule, savePrize, loadPrizes } from '@/lib/server/milestones';
import { DomainError } from '@/lib/server/errors';
import { assertLedgerBalanced, makeMerchantWithProduct, makeUser, resetDb } from './helpers';

const RULE_ID = 'rule_test';
// Threshold ₹1,000 so a single ₹1,000 verified order is enough in tests.
const THRESHOLD = 100_000n;

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

/** Buys and verifies one ₹1,000 order for a buyer, returning the verification time. */
async function verifiedPurchase(buyerId: string, productId: string, merchantId: string): Promise<Date> {
  const coupon = await createCoupon({
    code: `M${Math.random().toString(36).slice(2, 8).toUpperCase()}`, funding: 'MERCHANT', merchantId, percent: 10,
    maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 500_000n, perUserLimit: 50,
    startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
  }, 'test');
  await fundCouponPool(coupon.id, 500_000n, 'test');
  const order = await createOrder(buyerId, [{ productId, quantity: 1 }], coupon.code);
  await payOrder(order.id);
  await markDelivered(order.id, 'test');
  const windowEnds = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).returnWindowEndsAt!;
  const when = new Date(windowEnds.getTime() + 1000);
  await verifyOrder(order.id, 'test', when);
  return when;
}

describe('retail milestones', () => {
  beforeEach(async () => {
    await resetDb();
    // resetDb clears the seeded rule and prizes; put back a test rule and one prize.
    await db.milestoneRule.create({
      data: { id: RULE_ID, name: 'Test milestone', thresholdMinor: THRESHOLD, startsAt: new Date('2026-01-01T00:00:00Z'), active: true, updatedAt: new Date() },
    });
    await db.prize.create({
      data: { id: 'prize_test', name: 'Bike', model: 'Test Bike', imageUrl: '/prizes/bike-bajaj-pulsar.jpg', description: 'd', details: [], supplierNote: '', active: true, updatedAt: new Date() },
    });
  });

  it('qualifies a member once from their own verified sales, and re-running changes nothing', async () => {
    const buyer = await makeUser({ name: 'Buyer', kyc: 'VERIFIED' });
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const when = await verifiedPurchase(buyer.id, product.id, merchant.id);

    const first = await evaluateMilestones('test', when);
    expect(first).toEqual({ reached: 1, newAwards: 1 });
    const again = await evaluateMilestones('test', when);
    expect(again).toEqual({ reached: 1, newAwards: 0 });

    const award = await db.milestoneAward.findUniqueOrThrow({ where: { userId_ruleId: { userId: buyer.id, ruleId: RULE_ID } } });
    expect(award.status).toBe('QUALIFIED');
    expect(award.metricMinor).toBe(100_000n);

    const mine = await memberMilestone(buyer.id);
    expect(mine).toMatchObject({ percent: 100, reached: true, award: { status: 'QUALIFIED' } });
    await assertLedgerBalanced();
  });

  it('does not count sales that are fraud-withheld, or sales before the rule started', async () => {
    const buyer = await makeUser({ name: 'Withheld', kyc: 'VERIFIED' });
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const when = await verifiedPurchase(buyer.id, product.id, merchant.id);
    await db.order.updateMany({ where: { buyerId: buyer.id }, data: { commissionBlocked: 'self-purchase loop' } });
    expect(await evaluateMilestones('test', when)).toEqual({ reached: 0, newAwards: 0 });

    await db.order.updateMany({ where: { buyerId: buyer.id }, data: { commissionBlocked: null } });
    await updateRule(RULE_ID, { name: 'Test milestone', thresholdRupees: '1000', startsAt: new Date('2027-01-01T00:00:00Z'), endsAt: null, active: true }, 'test');
    expect(await evaluateMilestones('test', when)).toEqual({ reached: 0, newAwards: 0 });
  });

  it('walks an award through approve, hand over, and blocks invalid or repeated decisions', async () => {
    const buyer = await makeUser({ name: 'Winner', kyc: 'VERIFIED' });
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const when = await verifiedPurchase(buyer.id, product.id, merchant.id);
    await evaluateMilestones('test', when);
    const award = await db.milestoneAward.findFirstOrThrow({ where: { userId: buyer.id } });

    await expect(decideAward(award.id, 'APPROVE', {}, 'finance')).rejects.toThrow(/Choose the prize/);
    await expect(decideAward(award.id, 'FULFIL', {}, 'finance')).rejects.toBeInstanceOf(DomainError);

    await decideAward(award.id, 'APPROVE', { prizeId: 'prize_test', note: 'Checked' }, 'finance');
    let row = await db.milestoneAward.findUniqueOrThrow({ where: { id: award.id } });
    expect(row).toMatchObject({ status: 'APPROVED', prizeId: 'prize_test', decidedBy: 'finance', decisionNote: 'Checked' });

    await expect(decideAward(award.id, 'APPROVE', { prizeId: 'prize_test' }, 'finance')).rejects.toBeInstanceOf(DomainError);

    await decideAward(award.id, 'FULFIL', {}, 'finance');
    row = await db.milestoneAward.findUniqueOrThrow({ where: { id: award.id } });
    expect(row.status).toBe('FULFILLED');
    expect(row.fulfilledAt).not.toBeNull();

    const actions = (await db.auditLog.findMany({ where: { targetId: award.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['milestone.approve', 'milestone.fulfil']);
    await assertLedgerBalanced();
  });

  it('rejected milestones stay rejected and are not re-qualified by a later check', async () => {
    const buyer = await makeUser({ name: 'Declined', kyc: 'VERIFIED' });
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const when = await verifiedPurchase(buyer.id, product.id, merchant.id);
    await evaluateMilestones('test', when);
    const award = await db.milestoneAward.findFirstOrThrow({ where: { userId: buyer.id } });
    await decideAward(award.id, 'REJECT', { note: 'Duplicate account' }, 'finance');
    expect(await evaluateMilestones('test', when)).toEqual({ reached: 1, newAwards: 0 });
    expect((await db.milestoneAward.findUniqueOrThrow({ where: { id: award.id } })).status).toBe('REJECTED');
  });

  it('keeps prize records and hides inactive prizes from members', async () => {
    const saved = await savePrize(null, {
      name: 'Phone', model: 'Test Phone', imageUrl: '/prizes/iphone-duo.jpg', description: 'd', details: ['a'],
      supplierNote: '', sortOrder: 5, active: true,
    }, 'test');
    expect(saved.id.startsWith('prize_')).toBe(true);
    await savePrize('prize_test', {
      name: 'Bike', model: 'Test Bike', imageUrl: '/prizes/bike-bajaj-pulsar.jpg', description: 'd', details: [],
      supplierNote: '', sortOrder: 1, active: false,
    }, 'test');
    const visible = await loadPrizes();
    expect(visible.map((p) => p.id)).toEqual([saved.id]);
    await expect(db.auditLog.count({ where: { action: 'prize.updated' } })).resolves.toBe(1);
  });
});
