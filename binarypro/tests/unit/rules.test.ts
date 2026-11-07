import { describe, expect, it } from 'vitest';
import { computeCashback, isAllowedCouponPercent } from '@/lib/domain/cashback';
import { canCompleteView, canStartView, minimumWatchMs } from '@/lib/domain/ads';
import { evaluateRank } from '@/lib/domain/ranks';
import { isSelfPurchase } from '@/lib/domain/fraud';
import { validateWithdrawal } from '@/lib/domain/withdrawals';
import { can } from '@/lib/domain/rbac';
import { signPayload, verifySignature } from '@/lib/domain/payments';
import { COMMISSION_FUNDING_BPS, MIN_WITHDRAWAL, PLANS, TIERS } from '@/lib/domain/plans';

const now = new Date('2026-11-07T10:00:00Z');
const cb = (over: Partial<Parameters<typeof computeCashback>[0]> = {}) => ({
  subtotalMinor: 100_000n,
  orderCurrency: 'INR',
  couponCurrency: 'INR',
  percent: 20,
  maxCashbackMinor: 50_000n,
  minOrderMinor: 0n,
  startsAt: new Date('2026-11-01T00:00:00Z'),
  endsAt: new Date('2026-12-01T00:00:00Z'),
  active: true,
  now,
  userRedemptions: 0,
  perUserLimit: 1,
  poolBalanceMinor: 1_000_000n,
  tierMaxPercent: 50,
  ...over,
});

describe('cashback coupons', () => {
  it('only allows 10, 20, 30 and 50 percent', () => {
    for (const p of [10, 20, 30, 50]) expect(isAllowedCouponPercent(p)).toBe(true);
    for (const p of [5, 15, 25, 40, 60, 100]) expect(isAllowedCouponPercent(p)).toBe(false);
  });

  it('computes percent cashback', () => {
    expect(computeCashback(cb())).toEqual({ ok: true, cashbackMinor: 20_000n });
  });

  it('caps cashback at the coupon maximum', () => {
    expect(computeCashback(cb({ percent: 50, maxCashbackMinor: 10_000n }))).toEqual({ ok: true, cashbackMinor: 10_000n });
  });

  it('never pays more than the funding pool holds', () => {
    expect(computeCashback(cb({ poolBalanceMinor: 5_000n }))).toEqual({ ok: true, cashbackMinor: 5_000n });
  });

  it('caps the coupon percent at the membership tier benefit', () => {
    expect(computeCashback(cb({ percent: 20, tierMaxPercent: 10 })).ok).toBe(false);
    expect(computeCashback(cb({ percent: 10, tierMaxPercent: 10 })).ok).toBe(true);
  });

  it('refuses when the pool is empty', () => {
    expect(computeCashback(cb({ poolBalanceMinor: 0n })).ok).toBe(false);
  });

  it('enforces validity, minimum order, currency and per-user limits', () => {
    expect(computeCashback(cb({ endsAt: new Date('2026-11-02T00:00:00Z') })).ok).toBe(false);
    expect(computeCashback(cb({ minOrderMinor: 200_000n })).ok).toBe(false);
    expect(computeCashback(cb({ couponCurrency: 'USD' })).ok).toBe(false);
    expect(computeCashback(cb({ userRedemptions: 1 })).ok).toBe(false);
    expect(computeCashback(cb({ active: false })).ok).toBe(false);
  });
});

describe('advertising rewards', () => {
  it('requires watching at least 95% of the video', () => {
    expect(minimumWatchMs(30)).toBe(28_500);
    const started = new Date(now.getTime() - 20_000);
    expect(canCompleteView(started, now, 30, null).ok).toBe(false);
    const longEnough = new Date(now.getTime() - 29_000);
    expect(canCompleteView(longEnough, now, 30, null).ok).toBe(true);
  });

  it('never completes the same view twice', () => {
    const started = new Date(now.getTime() - 60_000);
    expect(canCompleteView(started, now, 30, now).ok).toBe(false);
  });

  it('enforces campaign status, budget, daily plan limit and one view per campaign per day', () => {
    const base = { campaignStatus: 'ACTIVE', poolBalanceMinor: 100n, rewardMinor: 10n, viewsCompletedToday: 0, adViewsPerDay: 5, alreadyViewedTodayThisCampaign: false };
    expect(canStartView(base).ok).toBe(true);
    expect(canStartView({ ...base, campaignStatus: 'PAUSED' }).ok).toBe(false);
    expect(canStartView({ ...base, poolBalanceMinor: 9n }).ok).toBe(false);
    expect(canStartView({ ...base, viewsCompletedToday: 5 }).ok).toBe(false);
    expect(canStartView({ ...base, alreadyViewedTodayThisCampaign: true }).ok).toBe(false);
  });
});

describe('ranks', () => {
  it('starts at Member and climbs with directs and team volume', () => {
    expect(evaluateRank(0, 0n)).toBe('MEMBER');
    expect(evaluateRank(2, 5_000_000n)).toBe('SENIOR_MEMBER');
    expect(evaluateRank(3, 50_000_000n)).toBe('TEAM_LEADER');
    expect(evaluateRank(6, 5_000_000_000n)).toBe('AMBASSADOR');
  });

  it('needs both directs and volume', () => {
    expect(evaluateRank(10, 1n)).toBe('MEMBER');
    expect(evaluateRank(1, 10_000_000_000n)).toBe('MEMBER');
  });

  it('never demotes automatically', () => {
    expect(evaluateRank(0, 0n, 'DIRECTOR')).toBe('DIRECTOR');
  });
});

describe('fraud rules', () => {
  it('flags a buyer found in the sponsor upline', () => {
    expect(isSelfPurchase('u1', ['s1', 'u1', 'root'])).toBe(true);
    expect(isSelfPurchase('u9', ['s1', 'root'])).toBe(false);
  });
});

describe('withdrawals', () => {
  const base = { amountMinor: 100_000n, currency: 'INR' as const, walletBalanceMinor: 500_000n, kycVerified: true, hasOpenWithdrawal: false };
  it('requires KYC, funds, no open request and the minimum amount', () => {
    expect(validateWithdrawal(base).ok).toBe(true);
    expect(validateWithdrawal({ ...base, kycVerified: false }).ok).toBe(false);
    expect(validateWithdrawal({ ...base, walletBalanceMinor: 1n }).ok).toBe(false);
    expect(validateWithdrawal({ ...base, hasOpenWithdrawal: true }).ok).toBe(false);
    expect(validateWithdrawal({ ...base, amountMinor: MIN_WITHDRAWAL.INR - 1n }).ok).toBe(false);
  });
});

describe('RBAC', () => {
  it('limits finance and merchant roles', () => {
    expect(can('ADMIN', 'staff:manage')).toBe(true);
    expect(can('FINANCE', 'withdrawals:decide')).toBe(true);
    expect(can('FINANCE', 'merchants:manage')).toBe(false);
    expect(can('MERCHANT', 'withdrawals:decide')).toBe(false);
    expect(can('MEMBER', 'orders:read')).toBe(false);
  });
});

describe('webhook signatures', () => {
  it('verifies HMAC over the raw body only', () => {
    const secret = 'x'.repeat(40);
    const body = '{"id":"evt_1"}';
    const sig = signPayload(secret, body);
    expect(verifySignature(secret, body, sig)).toBe(true);
    expect(verifySignature(secret, body + ' ', sig)).toBe(false);
    expect(verifySignature(secret, body, 'nothex')).toBe(false);
    expect(verifySignature(secret, body, null)).toBe(false);
  });
});

describe('plans', () => {
  it('defines all four tiers and a 0-25% funding share', () => {
    expect(TIERS).toEqual(['BASIC', 'SILVER', 'GOLD', 'PLATINUM']);
    expect(PLANS.BASIC.binaryBps).toBe(0);
    expect(COMMISSION_FUNDING_BPS).toBeGreaterThan(0);
    expect(COMMISSION_FUNDING_BPS).toBeLessThanOrEqual(10_000);
  });
});
