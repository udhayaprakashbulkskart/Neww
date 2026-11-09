import { describe, expect, it } from 'vitest';
import { cashActivationBlockers, eligibility, isPaidAndCurrent, isRewardLive, nextEligibleAt, pickIndex, segmentCentreDeg, spinRotation, DAY_MS } from '@/lib/domain/spin';

const now = new Date('2026-11-08T12:00:00Z');
const base = { enabled: true, now, nextEligibleAt: null, liveRewardCount: 3 };

describe('spin eligibility', () => {
  it('lets every member spin, paid or free, when nothing blocks them', () => {
    expect(eligibility(base)).toEqual({ eligible: true, reason: 'OK' });
  });

  it('blocks spins only for the switch, cooldown and an empty wheel', () => {
    expect(eligibility({ ...base, enabled: false }).reason).toBe('DISABLED');
    expect(eligibility({ ...base, nextEligibleAt: new Date(now.getTime() + 1000) }).reason).toBe('COOLDOWN');
    expect(eligibility({ ...base, liveRewardCount: 0 }).reason).toBe('NO_REWARDS');
  });

  it('opens again exactly when the cooldown ends', () => {
    const last = new Date(now.getTime() - 15 * DAY_MS);
    expect(eligibility({ ...base, nextEligibleAt: nextEligibleAt(last, 15) }).eligible).toBe(true);
    const justBefore = new Date(now.getTime() - 15 * DAY_MS + 1);
    expect(eligibility({ ...base, nextEligibleAt: nextEligibleAt(justBefore, 15) }).reason).toBe('COOLDOWN');
  });

  it('counts paid membership only when it is paid, active and not expired', () => {
    const future = new Date('2027-01-01T00:00:00Z');
    expect(isPaidAndCurrent({ tier: 'SILVER', active: true, expiresAt: future }, now)).toBe(true);
    expect(isPaidAndCurrent({ tier: 'BASIC', active: true, expiresAt: future }, now)).toBe(false);
    expect(isPaidAndCurrent({ tier: 'GOLD', active: true, expiresAt: new Date('2026-01-01T00:00:00Z') }, now)).toBe(false);
    expect(isPaidAndCurrent({ tier: 'GOLD', active: false, expiresAt: future }, now)).toBe(false);
    expect(isPaidAndCurrent(null, now)).toBe(false);
  });
});

describe('weighted selection', () => {
  it('maps draws to weighted buckets', () => {
    const w = [50, 30, 20];
    expect(pickIndex(w, 0)).toBe(0);
    expect(pickIndex(w, 49)).toBe(0);
    expect(pickIndex(w, 50)).toBe(1);
    expect(pickIndex(w, 79)).toBe(1);
    expect(pickIndex(w, 80)).toBe(2);
    expect(pickIndex(w, 99)).toBe(2);
  });

  it('rejects out-of-range draws', () => {
    expect(() => pickIndex([1, 1], 2)).toThrow();
    expect(() => pickIndex([1, 1], -1)).toThrow();
    expect(() => pickIndex([], 0)).toThrow();
  });
});

describe('wheel geometry', () => {
  it('puts the chosen segment under the pointer', () => {
    for (let n = 2; n <= 8; n++) {
      for (let i = 0; i < n; i++) {
        const rot = spinRotation(0, i, n, 5);
        const under = ((360 - (rot % 360)) % 360);
        expect(Math.abs(under - segmentCentreDeg(i, n))).toBeLessThan(1e-9);
        expect(rot).toBeGreaterThanOrEqual(5 * 360);
      }
    }
  });

  it('only ever moves forward', () => {
    expect(spinRotation(1000, 0, 3, 4)).toBeGreaterThan(1000);
  });
});

describe('cash rewards are locked by default', () => {
  const cash = { kind: 'CASH' as const, active: true, amountMinor: 50000n, cashLegalRef: 'LEGAL-REF-1', cashFundingRef: 'FUND-REF-1', cashActivatedAt: now };
  it('is not live without the platform switch', () => {
    expect(isRewardLive(cash, { cashSwitchOn: false, poolBalanceMinor: 10_000_000n })).toBe(false);
  });
  it('is not live without an activation record', () => {
    expect(isRewardLive({ ...cash, cashActivatedAt: null }, { cashSwitchOn: true, poolBalanceMinor: 10_000_000n })).toBe(false);
    expect(isRewardLive({ ...cash, cashLegalRef: null }, { cashSwitchOn: true, poolBalanceMinor: 10_000_000n })).toBe(false);
  });
  it('is not live when the pool cannot pay it', () => {
    expect(isRewardLive(cash, { cashSwitchOn: true, poolBalanceMinor: 49999n })).toBe(false);
  });
  it('is live only when every condition holds', () => {
    expect(isRewardLive(cash, { cashSwitchOn: true, poolBalanceMinor: 50000n })).toBe(true);
  });
  it('badges are live without money', () => {
    expect(isRewardLive({ kind: 'BADGE', active: true, amountMinor: 0n, cashLegalRef: null, cashFundingRef: null, cashActivatedAt: null }, { cashSwitchOn: false, poolBalanceMinor: 0n })).toBe(true);
  });
  it('lists every blocker for activation', () => {
    const blockers = cashActivationBlockers({ kind: 'CASH', amountMinor: 50000n, legalRef: '', fundingRef: '', cashSwitchOn: false });
    expect(blockers.length).toBe(3);
    expect(cashActivationBlockers({ kind: 'CASH', amountMinor: 50000n, legalRef: 'LEGAL-1234', fundingRef: 'FUND-1234', cashSwitchOn: true })).toEqual([]);
  });
});
