import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/server/db';
import { createOrder, markDelivered, verifyOrder, returnOrder } from '@/lib/server/orders';
import { handleCapturedEvent } from '@/lib/server/payments';
import { createCoupon, fundCouponPool } from '@/lib/server/coupons';
import { balanceOf } from '@/lib/server/ledger';
import { accounts } from '@/lib/server/accounts';
import { publishPolicy, runDailySettlement, setDailyCap } from '@/lib/server/commission-engine';
import { runReconciliation } from '@/lib/server/reconciliation';
import { walletSummary } from '@/lib/server/wallet';
import { can } from '@/lib/domain/rbac';
import { DomainError } from '@/lib/server/errors';
import { addDays } from '@/lib/server/time';
import { assertLedgerBalanced, makeMerchantWithProduct, makeUser, resetDb } from './helpers';

const pending = (u: string) => `PENDING_COMMISSION:${u}:INR`;
const NOW = new Date('2026-11-10T06:00:00Z'); // 11:30 in Kolkata on 10 Nov, so 9 Nov and earlier have ended

async function payOrder(orderId: string) {
  const payment = await db.payment.findFirstOrThrow({ where: { referenceId: orderId, kind: 'ORDER' } });
  return handleCapturedEvent({ id: `evt_${orderId}`, type: 'payment.captured', providerRef: payment.providerRef, amountMinor: payment.amountMinor.toString(), currency: payment.currency });
}

/** A genuine sale: created, paid, delivered 8 days before `verifiedAt`, then verified at `verifiedAt`. */
async function sale(buyerId: string, productId: string, couponCode: string | null, verifiedAt: Date) {
  const order = await createOrder(buyerId, [{ productId, quantity: 1 }], couponCode);
  await payOrder(order.id);
  await markDelivered(order.id, 'test', addDays(verifiedAt, -8));
  await verifyOrder(order.id, 'test', verifiedAt);
  return order.id;
}

async function admin() {
  return makeUser({ name: 'Owner', role: 'ADMIN' });
}

describe('financial engine', () => {
  let product: string;
  let merchant: string;
  let couponCode: string;
  let couponId: string;

  beforeEach(async () => {
    await resetDb();
    const m = await makeMerchantWithProduct(100_000n);
    product = m.product.id;
    merchant = m.merchant.id;
    couponCode = 'ENGINE10';
    const c = await createCoupon({
      code: couponCode, funding: 'MERCHANT', merchantId: merchant, percent: 10, maxCashbackMinor: 50_000n, minOrderMinor: 0n,
      currency: 'INR', budgetMinor: 50_000_000n, perUserLimit: 500, startsAt: addDays(new Date(), -400), endsAt: addDays(new Date(), 400),
    }, 'test');
    await fundCouponPool(c.id, 50_000_000n, 'test');
    couponId = c.id;
    const ops = await admin();
    await publishPolicy({ kind: 'PRODUCT', rateBps: 1000, active: true, legalApprovalRef: 'LEGAL-APPROVED-0001', reason: 'Approved for the test suite' }, ops.id);
  });

  it('caps each business day, carries the rest forward, and never counts carried commission twice', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Buyer' });
    await setDailyCap('150', 'Test cap of ₹150', ops.id);
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T06:00:00Z'));
    expect(await balanceOf(db, pending(buyer.id))).toBe(20_000n); // two sales, ₹100 each

    await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(15_000n);
    expect(await balanceOf(db, pending(buyer.id))).toBe(5_000n);
    const s1 = await db.dailyCommissionSummary.findUniqueOrThrow({ where: { userId_dayKey: { userId: buyer.id, dayKey: '2026-11-08' } } });
    expect(s1).toMatchObject({ eligibleMinor: 20_000n, carriedInMinor: 0n, payableMinor: 15_000n, carriedOutMinor: 5_000n, capMinor: 15_000n });

    // Next day, no new sales: the carried ₹50 is released, and nothing is counted as new commission.
    await runDailySettlement('2026-11-09', 'test', 'Daily release for test', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(20_000n);
    expect(await balanceOf(db, pending(buyer.id))).toBe(0n);
    const s2 = await db.dailyCommissionSummary.findUniqueOrThrow({ where: { userId_dayKey: { userId: buyer.id, dayKey: '2026-11-09' } } });
    expect(s2).toMatchObject({ eligibleMinor: 0n, carriedInMinor: 5_000n, payableMinor: 5_000n, carriedOutMinor: 0n });
    await assertLedgerBalanced();
  });

  it('applies the daily cap exactly once per member per business day', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Once' });
    await setDailyCap('150', 'Test cap', ops.id);
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T06:00:00Z'));
    const first = await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    const again = await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    expect(first.results.find((r) => r.userId === buyer.id)!.status).toBe('SETTLED');
    expect(again.results.find((r) => r.userId === buyer.id)!.status).toBe('ALREADY_SETTLED');
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(15_000n);
    expect(await db.dailyCommissionSummary.count({ where: { userId: buyer.id, dayKey: '2026-11-08' } })).toBe(1);
  });

  it('settles simultaneous runs without double release', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Race' });
    await setDailyCap('150', 'Test cap', ops.id);
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T06:00:00Z'));
    await Promise.allSettled([
      runDailySettlement('2026-11-08', 'test', 'Race run one', NOW),
      runDailySettlement('2026-11-08', 'test', 'Race run two', NOW),
    ]);
    expect(await db.dailyCommissionSummary.count({ where: { userId: buyer.id, dayKey: '2026-11-08' } })).toBe(1);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(15_000n);
    await assertLedgerBalanced();
  });

  it('applies a changed cap to the next settlement, and refuses to settle with no cap', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Cap' });
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await setDailyCap(null, 'Remove cap for test', ops.id);
    await expect(runDailySettlement('2026-11-08', 'test', 'No cap should refuse', NOW)).rejects.toMatchObject({ code: 'CAP_NOT_CONFIGURED' });
    await setDailyCap('5', 'Lower cap', ops.id);
    await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(500n);
    expect(await balanceOf(db, pending(buyer.id))).toBe(9_500n);
    // Raise the cap: the carried commission is released on the next day.
    await setDailyCap('10000', 'Raise cap', ops.id);
    await runDailySettlement('2026-11-09', 'test', 'Daily release for test', NOW);
    expect(await balanceOf(db, pending(buyer.id))).toBe(0n);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(10_000n);
    expect((await db.auditLog.count({ where: { action: 'cap.changed' } }))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the business day in Asia/Kolkata at the boundary', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Boundary' });
    await setDailyCap('10000', 'Test cap', ops.id);
    // 18:45 UTC on 8 Nov is 00:15 on 9 Nov in Kolkata, so this sale belongs to 9 Nov.
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T18:45:00Z'));
    const entry = await db.commissionEntry.findFirstOrThrow({ where: { userId: buyer.id } });
    expect(entry.dayKey).toBe('2026-11-09');
    await runDailySettlement('2026-11-08', 'test', 'Day before the sale', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(0n);
    await runDailySettlement('2026-11-09', 'test', 'Day of the sale', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(10_000n);
  });

  it('will not settle a business day that has not ended yet', async () => {
    const ops = await admin();
    await setDailyCap('10000', 'Test cap', ops.id);
    await expect(runDailySettlement('2026-11-10', 'test', 'Today is not over', NOW)).rejects.toBeInstanceOf(DomainError);
  });

  it('reverses pending commission, volume and the merchant budget when a sale is returned before release', async () => {
    const buyer = await makeUser({ name: 'Refund' });
    const orderId = await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    expect(await balanceOf(db, pending(buyer.id))).toBe(10_000n);
    await returnOrder(orderId, 'test', new Date('2026-11-08T09:00:00Z'), 'Customer return');
    expect(await balanceOf(db, pending(buyer.id))).toBe(0n);
    expect(await balanceOf(db, accounts.merchantPool(merchant, 'INR').key)).toBe(50_000_000n);
    const refund = await db.refund.findUniqueOrThrow({ where: { orderId } });
    expect(refund).toMatchObject({ amountMinor: 100_000n, reason: 'Customer return' });
    // Nothing is released for a returned sale.
    const ops = await admin();
    await setDailyCap('10000', 'Test cap', ops.id);
    await runDailySettlement('2026-11-08', 'test', 'Nothing to release today', NOW);
    expect(await balanceOf(db, accounts.wallet(buyer.id, 'INR').key)).toBe(0n);
    await assertLedgerBalanced();
  });

  it('refuses a second verification of the same sale without a second accrual', async () => {
    const buyer = await makeUser({ name: 'Twice' });
    const orderId = await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    const again = await verifyOrder(orderId, 'test', new Date('2026-11-08T07:00:00Z')).catch((e) => e);
    expect(again instanceof DomainError || (again as { alreadyVerified?: boolean }).alreadyVerified === true).toBe(true);
    expect(await db.commissionEntry.count({ where: { orderId } })).toBe(1);
    expect(await db.volumeEntry.count({ where: { orderId, kind: 'ACCRUE' } })).toBe(1);
    expect(await balanceOf(db, pending(buyer.id))).toBe(10_000n);
  });

  it('carries forward unmatched volume with no expiry, separate from money', async () => {
    const buyer = await makeUser({ name: 'Volume' });
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-09T05:00:00Z'));
    const vol = async () => (await db.volumeEntry.findMany({ where: { userId: buyer.id } })).reduce((a, v) => a + (v.kind === 'ACCRUE' ? v.pvMinor : -v.pvMinor), 0n);
    expect(await vol()).toBe(200_000n);
    const ops = await admin();
    await setDailyCap('10000', 'Test cap', ops.id);
    await runDailySettlement('2026-11-09', 'test', 'Daily release for test', NOW);
    expect(await vol()).toBe(200_000n); // settlement never touches volume
    expect((await walletSummary(buyer.id)).available).toBe(20_000n);
    expect(await db.volumeEntry.count({ where: { userId: buyer.id, kind: 'ACCRUE' } })).toBe(2);
  });

  it('keeps product commission off until a policy is approved, and versions every change', async () => {
    const ops = await admin();
    const quiet = await makeUser({ name: 'Quiet' });
    // Activate v2 at 5%: v1 stays in history, v2 is the current policy.
    const v2 = await publishPolicy({ kind: 'PRODUCT', rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-0002', reason: 'Lower rate for test' }, ops.id);
    expect(v2.version).toBe(2);
    await setDailyCap('10000', 'Test cap', ops.id);
    await sale(quiet.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    expect((await db.commissionEntry.findFirstOrThrow({ where: { userId: quiet.id } })).policyVersion).toBe(2);
    expect(await balanceOf(db, pending(quiet.id))).toBe(5_000n);
    expect(await db.commissionPolicy.count({ where: { kind: 'PRODUCT' } })).toBe(2);
  });

  it('refuses sponsor and binary policies and any activation without approval', async () => {
    const ops = await admin();
    await expect(publishPolicy({ kind: 'BINARY', rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-0003', reason: 'Attempt to activate' }, ops.id)).rejects.toMatchObject({ code: 'ACTIVATION_BLOCKED' });
    await expect(publishPolicy({ kind: 'DIRECT_SPONSOR', rateBps: 500, active: true, legalApprovalRef: 'LEGAL-APPROVED-0003', reason: 'Attempt to activate' }, ops.id)).rejects.toMatchObject({ code: 'ACTIVATION_BLOCKED' });
    await expect(publishPolicy({ kind: 'SERVICE', rateBps: 500, active: true, reason: 'No approval given' }, ops.id)).rejects.toMatchObject({ code: 'ACTIVATION_BLOCKED' });
    await expect(publishPolicy({ kind: 'SERVICE', rateBps: 500, active: false, reason: 'Draft is allowed' }, ops.id)).resolves.toBeDefined();
  });

  it('reconciles clean after a full cycle, and records every run', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Recon' });
    await setDailyCap('150', 'Test cap', ops.id);
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T06:00:00Z'));
    const refundMe = await sale(buyer.id, product, couponCode, new Date('2026-11-08T07:00:00Z'));
    await returnOrder(refundMe, 'test', new Date('2026-11-08T09:00:00Z'));
    await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    await runDailySettlement('2026-11-09', 'test', 'Daily release for test', NOW);
    const report = await runReconciliation(ops.id, 'Month-end check', NOW);
    expect(report.findings.filter((f) => !f.ok)).toEqual([]);
    expect(report.status).toBe('PASS');
    expect(await db.reconciliationReport.count()).toBe(1);
    await assertLedgerBalanced();
  });

  it('shows the four member balances consistently with the ledger', async () => {
    const ops = await admin();
    const buyer = await makeUser({ name: 'Four', kyc: 'VERIFIED' });
    await setDailyCap('150', 'Test cap', ops.id);
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T05:00:00Z'));
    await sale(buyer.id, product, couponCode, new Date('2026-11-08T06:00:00Z'));
    await runDailySettlement('2026-11-08', 'test', 'Daily release for test', NOW);
    const w = await walletSummary(buyer.id);
    expect(w).toEqual({ available: 15_000n, pending: 5_000n, withdrawable: 15_000n, withdrawn: 0n, reversed: 0n });
    const refundMe = await sale(buyer.id, product, couponCode, new Date('2026-11-08T07:00:00Z'));
    await returnOrder(refundMe, 'test', new Date('2026-11-08T09:00:00Z'));
    expect((await walletSummary(buyer.id)).reversed).toBe(10_000n);
  });

  it('gives finance read access to the engine but not the power to change it', () => {
    expect(can('ADMIN', 'engine:manage')).toBe(true);
    expect(can('FINANCE', 'engine:manage')).toBe(false);
    expect(can('FINANCE', 'engine:read')).toBe(true);
    expect(can('MEMBER', 'engine:read')).toBe(false);
    expect(can('MERCHANT', 'engine:manage')).toBe(false);
  });
});
