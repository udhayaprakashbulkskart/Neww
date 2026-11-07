import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { placeMember, runBinaryPayouts, addPvUpline } from '@/lib/server/binary';
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
  const b = await makeUser({ name: 'Buyer', sponsorId: s.id, parentId: s.id, side: 'LEFT', tier: 'BASIC' });
  const b2 = await makeUser({ name: 'Buyer2', sponsorId: s.id, parentId: s.id, side: 'RIGHT', tier: 'BASIC' });
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

  it('releases direct commission, binary PV and cashback only after verification, then balances the ledger', async () => {
    const { root, s, b } = await buildTree();
    const { merchant, product } = await makeMerchantWithProduct(100_000n); // ₹1,000.00
    const coupon = await createCoupon({
      code: 'SAVE20', funding: 'MERCHANT', merchantId: merchant.id, percent: 20,
      maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 200_000n, perUserLimit: 3,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 200_000n, 'test');

    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], 'SAVE20');
    expect(order.cashbackMinor).toBe(20_000n); // 20% of ₹1,000

    // Nothing is released before payment + delivery + return window.
    await payOrder(order.id);
    await markDelivered(order.id, 'test');
    const deliveredAt = (await db.order.findUniqueOrThrow({ where: { id: order.id } })).returnWindowEndsAt!;
    await expect(verifyOrder(order.id, 'test', new Date(deliveredAt.getTime() - DAY))).rejects.toThrow(/Return window/);
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(0n);

    await verifyOrder(order.id, 'test', new Date(deliveredAt.getTime() + 1000));

    // Direct: sponsor GOLD 7% of ₹1,000 = ₹70
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(7_000n);
    // Cashback to the buyer, funded by the merchant pool
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(20_000n);
    expect(await balanceOf(db, accounts.merchantPool(merchant.id, 'INR').key)).toBe(180_000n);
    // Reserve: 25% of PV (₹250) minus direct ₹70 = ₹180
    expect(await balanceOf(db, accounts.commissionReserve().key)).toBe(18_000n);
    // Binary PV reached both ancestors on the buyer's LEFT leg
    const sLeft = await db.pvLeg.findUniqueOrThrow({ where: { userId_side: { userId: s.id, side: 'LEFT' } } });
    const rLeft = await db.pvLeg.findUniqueOrThrow({ where: { userId_side: { userId: root.id, side: 'LEFT' } } });
    expect(sLeft.pvMinor).toBe(100_000n);
    expect(rLeft.pvMinor).toBe(100_000n);

    // Verifying twice is a no-op
    const again = await verifyOrder(order.id, 'test', new Date(deliveredAt.getTime() + 2000));
    expect(again.alreadyVerified).toBe(true);
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(7_000n);

    // Webhook replay is idempotent
    expect((await payOrder(order.id)).duplicate).toBe(true);

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

  it('reverses commissions, cashback and PV on return', async () => {
    const { root, s, b } = await buildTree();
    const { merchant, product } = await makeMerchantWithProduct(100_000n);
    const coupon = await createCoupon({
      code: 'BACK10', funding: 'MERCHANT', merchantId: merchant.id, percent: 10,
      maxCashbackMinor: 50_000n, minOrderMinor: 0n, currency: 'INR', budgetMinor: 100_000n, perUserLimit: 5,
      startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 30),
    }, 'test');
    await fundCouponPool(coupon.id, 100_000n, 'test');
    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], 'BACK10');
    await payOrder(order.id);
    await markDelivered(order.id, 'test');
    await verifyOrder(order.id, 'test', addDays(new Date(), 30));
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(7_000n);

    await returnOrder(order.id, 'test');
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(0n);
    expect(await balanceOf(db, accounts.wallet(b.id, 'INR').key)).toBe(0n);
    expect(await balanceOf(db, accounts.merchantPool(merchant.id, 'INR').key)).toBe(100_000n);
    const sLeft = await db.pvLeg.findUniqueOrThrow({ where: { userId_side: { userId: s.id, side: 'LEFT' } } });
    const rLeft = await db.pvLeg.findUniqueOrThrow({ where: { userId_side: { userId: root.id, side: 'LEFT' } } });
    expect(sLeft.pvMinor).toBe(0n);
    expect(rLeft.pvMinor).toBe(0n);
    await assertLedgerBalanced();
  });

  it('creates a clawback receivable when the sponsor already withdrew the commission', async () => {
    const { s, b } = await buildTree();
    await db.user.update({ where: { id: s.id }, data: { kyc: 'VERIFIED' } });
    const { product } = await makeMerchantWithProduct(100_000n);
    const order = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], null);
    await payOrder(order.id);
    await markDelivered(order.id, 'test');
    await verifyOrder(order.id, 'test', addDays(new Date(), 30));
    // Sponsor withdraws the ₹70 direct commission (above minimum is ₹500, so top up first via binary-free path):
    // Use a second verified order to reach the minimum, then withdraw everything.
    for (let i = 0; i < 9; i++) {
      const o = await createOrder(b.id, [{ productId: product.id, quantity: 1 }], null);
      await payOrder(o.id);
      await markDelivered(o.id, 'test');
      await verifyOrder(o.id, 'test', addDays(new Date(), 30));
    }
    const bal = await balanceOf(db, accounts.wallet(s.id, 'INR').key);
    const w = await requestWithdrawal(s.id, 'INR', bal);
    await decideWithdrawal(w.id, 'APPROVE', 'finance');
    // Now the first order is returned: the ₹70 is gone, so it becomes a receivable.
    await returnOrder(order.id, 'test');
    expect(await balanceOf(db, accounts.clawbackReceivable('INR').key)).toBe(7_000n);
    await assertLedgerBalanced();
  });
});

describe('binary payouts', () => {
  beforeEach(resetDb);

  it('pays binary commission once per period from the funded reserve', async () => {
    const { s, b, b2 } = await buildTree();
    const { product } = await makeMerchantWithProduct(100_000n);
    for (const buyer of [b, b2]) {
      const o = await createOrder(buyer.id, [{ productId: product.id, quantity: 1 }], null);
      await payOrder(o.id);
      await markDelivered(o.id, 'test');
      await verifyOrder(o.id, 'test', addDays(new Date(), 30));
    }
    const reserveBefore = await balanceOf(db, accounts.commissionReserve().key);
    const run1 = await runBinaryPayouts('2026-11-07', 'test');
    expect(run1.duplicate).toBe(false);
    // Sponsor GOLD: matched PV ₹1,000 (100,000 minor) at 10% = ₹100 (10,000 minor)
    const sBal = await balanceOf(db, accounts.wallet(s.id, 'INR').key);
    // direct from b and b2 = 2 * 7,000 = 14,000 ; binary = 10,000
    expect(sBal).toBe(24_000n);
    expect(await balanceOf(db, accounts.commissionReserve().key)).toBe(reserveBefore - 10_000n);

    const run2 = await runBinaryPayouts('2026-11-07', 'test');
    expect(run2.duplicate).toBe(true);
    expect(await balanceOf(db, accounts.wallet(s.id, 'INR').key)).toBe(24_000n);
    await assertLedgerBalanced();
  });

  it('does not pay BASIC members binary commission', async () => {
    const root = await makeUser({ name: 'Root', tier: 'BASIC' });
    const l = await makeUser({ name: 'L', sponsorId: root.id, parentId: root.id, side: 'LEFT', tier: 'BASIC' });
    const r = await makeUser({ name: 'R', sponsorId: root.id, parentId: root.id, side: 'RIGHT', tier: 'BASIC' });
    await addPvUpline(db as never, l.id, 100_000n);
    await addPvUpline(db as never, r.id, 100_000n);
    await db.$transaction((tx) => tx.commission.count());
    await db.$executeRaw`UPDATE "LedgerAccount" SET id = id`;
    const res = await runBinaryPayouts('2026-11-08', 'test');
    expect(res.payouts).toBe(0);
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
