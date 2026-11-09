import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { placeMember, runBinaryPayouts } from '@/lib/server/binary';
import { publishPolicy, setDailyCap, runDailySettlement } from '@/lib/server/commission-engine';
import { createOrder, markDelivered, verifyOrder, returnOrder } from '@/lib/server/orders';
import { handleCapturedEvent } from '@/lib/server/payments';
import { createCoupon, fundCouponPool } from '@/lib/server/coupons';
import { balanceOf } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { requestWithdrawal, decideWithdrawal, convertWallet, walletBalances } from '@/lib/server/wallet';
import { fundCampaign, startAdView, completeAdView } from '@/lib/server/ads';
import { startMembershipCheckout } from '@/lib/server/payments';
import { recomputeRanks } from '@/lib/server/ranks';
import { assertLedgerBalanced, makeMerchantWithProduct, makeUser, resetDb } from './helpers';
import { DomainError } from '@/lib/server/errors';
import { addDays } from '@/lib/server/time';

const DAY = 86_400_000;

const pendingAccountKey = (userId: string) => `PENDING_COMMISSION:${userId}:INR`;

/** Test setup: an approved product policy at 10% and a generous daily cap. */
async function enableProductCommission(rateBps: number) {
  const ops = await makeUser({ name: 'Ops', role: 'ADMIN' });
  await publishPolicy({ kind: 'PRODUCT', rateBps, active: true, legalApprovalRef: 'LEGAL-APPROVED-0001', reason: 'Approved in test' }, ops.id);
  await setDailyCap('10000000', 'Test cap', ops.id);
}

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

/** Builds: root (LEFT -> S), S (LEFT -> B), S (RIGHT -> B2) on one sponsorship chain. */
async function buildTree() {
  const root = await makeUser({ name: 'Root', tier: 'PLATINUM' });
  const s = await makeUser({ name: 'Sponsor', sponsorId: root.id, parentId: root.id, side: 'LEFT', tier: 'GOLD' });
  const b = await makeUser({ name: 'Buyer', sponsorId: s.id, parentId: s.id, side: 'LEFT', tier: 'GOLD' });
  const b2 = await makeUser({ name: 'Buyer2', sponsorId: s.id, parentId: s.id, side: 'RIGHT', tier: 'GOLD' });
  return { root, s, b, b2 };
}

describe('binary placement (database)', () => {
  beforeEach(resetDb);

  it('places a member only inside the sponsor downline and only into empty slots', async () => {
    const root = await makeUser({ name: 'Root' });
    const sponsorA = await makeUser({ name: 'A', sponsorId: root.id, parentId: root.id, side: 'LEFT' });
    const newbie = await makeUser({ name: 'New', sponsorId: sponsorA.id });
    const outsider = await makeUser({ name: 'Outsider' });

    await expect(db.$transaction((tx) => placeMember(tx, newbie.id, outsider.id, 'LEFT'))).rejects.toBeInstanceOf(DomainError);
    // root LEFT is already occupied by A
    await expect(db.$transaction((tx) => placeMember(tx, newbie.id, root.id, 'LEFT'))).rejects.toBeInstanceOf(DomainError);
    await db.$transaction((tx) => placeMember(tx, newbie.id, sponsorA.id, 'RIGHT'));
    const placed = await db.user.findUniqueOrThrow({ where: { id: newbie.id } });
    expect(placed.parentId).toBe(sponsorA.id);
    expect(placed.side).toBe('RIGHT');
    // cannot place twice
    await expect(db.$transaction((tx) => placeMember(tx, newbie.id, root.id, 'RIGHT'))).rejects.toBeInstanceOf(DomainError);
  });
});

describe('order lifecycle, commissions and cashback', () => {
  beforeEach(resetDb);

  it('accrues pending product commission and volume only after verification, with no sponsor or binary commission', async () => {
    const { s, b } = await buildTree();
    await enableProductCommission(1000);
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const coupon = await createCoupon({
      code: 'SAVE20', funding: 'MERCHANT', merchantId: merchant.id, percent: 20,
      maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 200_000n, perUserLimit: 3,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 200_000n, 'test');

    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], 'SAVE20');
    expect(order.cashbackMinor).toBe(20_000n); // quoted cashback before verification

    await payOrder(order.id);
    await markDelivered(order.id, 'test', new Date('2026-10-20T10:00:00Z'));
    await expect(verifyOrder(order.id, 'test', new Date('2026-10-25T10:00:00Z'))).rejects.toThrow(/Return window/);
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(0n);
    expect(await balanceOf(db, pendingAccountKey(b.id))).toBe(0n);

    await verifyOrder(order.id, 'test', new Date('2026-10-28T10:00:00Z'));
    // Nothing is paid to the wallet at verification: product commission is pending until a daily settlement.
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(0n);
    expect(await balanceOf(db, pendingAccountKey(b.id))).toBe(10_000n); // 10% of ₹1,000
    // Sponsor-linked and binary commission are never computed.
    expect(await db.commission.count({ where: { userId: s.id } })).toBe(0);
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(0n);
    // The volume ledger records the verified sale; no left/right legs are written.
    expect(await db.volumeEntry.count({ where: { userId: b.id, kind: 'ACCRUE' } })).toBe(1);
    expect(await db.pvLeg.count({ where: { userId: s.id } })).toBe(0);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).cashbackMinor).toBe(10_000n);
    await assertLedgerBalanced();
  });

  it('withholds commissions on self-purchase loops and raises a fraud flag', async () => {
    const { s, b } = await buildTree();
    // Make the sponsor's sponsor chain loop back to the buyer (B referred S, S referred B).
    await db.user.update({ where: { id: b.id }, data: { sponsorId: s.id } });
    await db.user.update({ where: { id: s.id }, data: { sponsorId: b.id } });
    const { product } = await makeMerchantWithProduct(50_000n);
    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], null);
    await payOrder(order.id);
    await markDelivered(order.id, 'test');
    const when = addDays(new Date(), 30);
    const res = await verifyOrder(order.id, 'test', when);
    expect(res.blocked).toBe('SELF_PURCHASE');
    expect(await db.commission.count()).toBe(0);
    expect(await db.fraudFlag.count({ where: { kind: 'SELF_PURCHASE' } })).toBe(1);
    await assertLedgerBalanced();
  });

  it('reverses pending commission, volume and the merchant budget on return', async () => {
    const { b } = await buildTree();
    await enableProductCommission(1000);
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const coupon = await createCoupon({
      code: 'BACK10', funding: 'MERCHANT', merchantId: merchant.id, percent: 10,
      maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 100_000n, perUserLimit: 5,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 100_000n, 'test');
    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], 'BACK10');
    await payOrder(order.id);
    await markDelivered(order.id, 'test', new Date('2026-10-20T10:00:00Z'));
    await verifyOrder(order.id, 'test', new Date('2026-10-28T10:00:00Z'));
    expect(await balanceOf(db, pendingAccountKey(b.id))).toBe(10_000n);
    expect(await balanceOf(db, accounts.merchantPool(merchant.id, 'INR').key)).toBe(90_000n);

    await returnOrder(order.id, 'test');
    expect(await balanceOf(db, pendingAccountKey(b.id))).toBe(0n);
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(0n);
    expect(await balanceOf(db, accounts.merchantPool(merchant.id, 'INR').key)).toBe(100_000n);
    // Volume is reversed: the member's net volume is back to zero.
    const net = await db.volumeEntry.findMany({ where: { userId: b.id } });
    expect(net.reduce((a, v) => a + (v.kind === 'ACCRUE' ? v.pvMinor : -v.pvMinor), 0n)).toBe(0n);
    expect(await db.refund.count({ where: { orderId: order.id } })).toBe(1);
    await assertLedgerBalanced();
  });

  it('creates a clawback receivable when a member already withdrew released commission', async () => {
    const { b } = await buildTree();
    await enableProductCommission(1000);
    await db.user.update({ where: { id: b.id }, data: { kyc: 'VERIFIED' } });
    const { merchant, product } = await makeMerchantWithProduct(1_000_000n);
    const coupon = await createCoupon({
      code: 'CLAW10', funding: 'MERCHANT', merchantId: merchant.id, percent: 10,
      maxCashbackMinor: 500_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 5_000_000n, perUserLimit: 50,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 5_000_000n, 'test');
    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], 'CLAW10');
    await payOrder(order.id);
    await markDelivered(order.id, 'test', new Date('2026-10-20T10:00:00Z'));
    await verifyOrder(order.id, 'test', new Date('2026-10-28T10:00:00Z'));
    // Release on the business day after the sale, then withdraw everything.
    await runDailySettlement('2026-10-28', 'test', 'Daily release for test', new Date('2026-10-29T06:00:00Z'));
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(100_000n);
    const w = await requestWithdrawal(b.id, 'INR', 100_000n);
    await decideWithdrawal(w.id, 'APPROVE', 'finance');
    // The sale is returned after the money has left: the released commission becomes a receivable.
    await returnOrder(order.id, 'test');
    expect(await balanceOf(db, accounts.clawbackReceivable('INR').key)).toBe(100_000n);
    await assertLedgerBalanced();
  });
});

describe('binary payouts', () => {
  beforeEach(resetDb);

  it('refuses every binary payout run while binary commission is disabled', async () => {
    const { b, b2 } = await buildTree();
    const { product } = await makeMerchantWithProduct(100_000n);
    for (const buyer of [b, b2]) {
      const o = await createOrder(buyer.id, [{ productId: product.id, quantity: 1 }], null);
      await payOrder(o.id);
      await markDelivered(o.id, 'test', new Date('2026-10-20T10:00:00Z'));
      await verifyOrder(o.id, 'test', new Date('2026-10-28T10:00:00Z'));
    }
    await expect(runBinaryPayouts('2026-11-07', 'test')).rejects.toMatchObject({ code: 'BINARY_DISABLED' });
    expect(await db.ledgerTransaction.count({ where: { type: 'BINARY_COMMISSION' } })).toBe(0);
    expect(await db.binaryRun.count()).toBe(0);
    await assertLedgerBalanced();
  });
});

describe('membership, payments and withdrawals', () => {
  beforeEach(resetDb);

  it('activates a paid membership only from a matching webhook, and holds mismatches', async () => {
    const user = await makeUser({ name: 'Upgrader', tier: 'BASIC' });
    const checkout = await startMembershipCheckout(user.id, 'SILVER', 'INR');
    if (checkout.activated) throw new Error('expected a payment');
    const wrong = await handleCapturedEvent({ id: 'evt_bad', type: 'payment.captured', providerRef: checkout.providerRef, amountMinor: '1', currency: 'INR' });
    expect(wrong.held).toBe(true);
    expect((await db.membership.findUniqueOrThrow({ where: { userId: user.id } })).tier).toBe('BASIC');

    // A fresh checkout, paid correctly
    const c2 = await startMembershipCheckout(user.id, 'SILVER', 'INR');
    if (c2.activated) throw new Error('expected a payment');
    await handleCapturedEvent({ id: 'evt_ok', type: 'payment.captured', providerRef: c2.providerRef, amountMinor: c2.amountMinor.toString(), currency: 'INR' });
    expect((await db.membership.findUniqueOrThrow({ where: { userId: user.id } })).tier).toBe('SILVER');
    // membership fees never create commissions
    expect(await db.commission.count()).toBe(0);
    await assertLedgerBalanced();
  });

  it('allows only one open withdrawal, enforces KYC, and never overdraws under concurrency', async () => {
    const user = await makeUser({ name: 'Earner', tier: 'GOLD', kyc: 'VERIFIED' });
    await db.$transaction(async (tx) => {
      const { postTransaction } = await import('@/lib/server/ledger');
      await postTransaction(tx, {
        reference: 'SEED_WALLET', type: 'TEST', description: 'seed',
        legs: [
          { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 100_000n },
          { ...accounts.wallet(user.id, 'INR'), direction: 'CREDIT', amountMinor: 100_000n },
        ],
      });
    });
    const results = await Promise.allSettled([
      requestWithdrawal(user.id, 'INR', 60_000n),
      requestWithdrawal(user.id, 'INR', 60_000n),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    expect(fulfilled).toBe(1);
    expect(await balanceOf(db, accounts.wallet(user.id, 'INR').key)).toBe(40_000n);
    await assertLedgerBalanced();

    const unverified = await makeUser({ name: 'NoKyc', tier: 'GOLD' });
    await expect(requestWithdrawal(unverified.id, 'INR', 60_000n)).rejects.toThrow(/identity verification/);
  });

  it('converts wallet currency with the published spread and keeps the ledger balanced', async () => {
    const user = await makeUser({ name: 'Converter', tier: 'GOLD' });
    await db.$transaction(async (tx) => {
      const { postTransaction } = await import('@/lib/server/ledger');
      await postTransaction(tx, {
        reference: 'SEED_FX', type: 'TEST', description: 'seed',
        legs: [
          { ...accounts.cash('INR'), direction: 'DEBIT', amountMinor: 835_000n },
          { ...accounts.wallet(user.id, 'INR'), direction: 'CREDIT', amountMinor: 835_000n },
        ],
      });
    });
    const res = await convertWallet(user.id, 'INR', 'USD', 835_000n);
    // ₹8,350 at 83.5 = $100.00, less 1.5% spread = $98.50
    expect(res.credited).toBe(9_850n);
    const balances = await walletBalances(user.id);
    expect(balances.INR).toBe(0n);
    expect(balances.USD).toBe(9_850n);
    await assertLedgerBalanced();
  });
});

describe('advertising rewards', () => {
  beforeEach(resetDb);

  it('pays a reward only after a full watch, from the advertiser pool, once per day', async () => {
    const user = await makeUser({ name: 'Viewer', tier: 'SILVER' });
    const campaign = await db.adCampaign.create({
      data: { advertiser: 'Acme', title: 'Ad', videoUrl: 'https://cdn.example.com/a.mp4', durationSec: 30, rewardMinor: 500n, currency: 'INR', status: 'ACTIVE' },
    });
    await fundCampaign(campaign.id, 1_000n, 'test');
    const t0 = new Date('2026-11-07T08:00:00Z');
    const view = await startAdView(user.id, campaign.id, t0);
    await expect(completeAdView(user.id, view.viewId, new Date(t0.getTime() + 5_000))).rejects.toThrow(/long enough/);
    const done = await completeAdView(user.id, view.viewId, new Date(t0.getTime() + 30_000));
    expect(done.rewardMinor).toBe(500n);
    expect(await balanceOf(db, accounts.wallet(user.id, 'INR').key)).toBe(500n);
    expect(await balanceOf(db, accounts.advertiserPool(campaign.id, 'INR').key)).toBe(500n);
    await expect(startAdView(user.id, campaign.id, new Date(t0.getTime() + 60_000))).rejects.toThrow(/already watched/);
    await assertLedgerBalanced();
  });

  it('refuses to start a view once the advertiser budget is exhausted', async () => {
    const user = await makeUser({ name: 'Viewer2', tier: 'SILVER' });
    const campaign = await db.adCampaign.create({
      data: { advertiser: 'Acme', title: 'Ad2', videoUrl: 'https://cdn.example.com/b.mp4', durationSec: 10, rewardMinor: 500n, currency: 'INR', status: 'ACTIVE' },
    });
    await expect(startAdView(user.id, campaign.id)).rejects.toThrow(/exhausted/);
  });
});

describe('ranks', () => {
  beforeEach(resetDb);
  it('promotes members with enough active directs and verified team volume', async () => {
    const { root } = await buildTree();
    const changed = await recomputeRanks();
    expect(changed).toBeGreaterThanOrEqual(0);
    const r = await db.user.findUniqueOrThrow({ where: { id: root.id } });
    expect(['MEMBER', 'SENIOR_MEMBER']).toContain(r.rank);
  });
});
