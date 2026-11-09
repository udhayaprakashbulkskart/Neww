import { describe, expect, it } from 'vitest';
import { businessDayKey, policyActivationBlockers, previousBusinessDay, productCommission, settleDay, validateDailyCap } from '@/lib/domain/finance-engine';

describe('business day (Asia/Kolkata)', () => {
  it('uses the Indian calendar date, not UTC', () => {
    // 2026-11-08 18:45 UTC is 2026-11-09 00:15 in Kolkata
    expect(businessDayKey(new Date('2026-11-08T18:45:00Z'))).toBe('2026-11-09');
    expect(businessDayKey(new Date('2026-11-08T18:29:59Z'))).toBe('2026-11-08');
    expect(businessDayKey(new Date('2026-11-08T18:30:00Z'))).toBe('2026-11-09');
  });
  it('steps back across month boundaries', () => {
    expect(previousBusinessDay('2026-03-01')).toBe('2026-02-28');
    expect(previousBusinessDay('2026-01-01')).toBe('2025-12-31');
  });
});

describe('daily cap settlement', () => {
  it('releases up to the cap and carries the rest', () => {
    expect(settleDay({ eligibleMinor: 80_000n, carriedInMinor: 0n, capMinor: 50_000n })).toEqual({ payableMinor: 50_000n, carriedOutMinor: 30_000n });
  });
  it('releases carried commission on a later day without counting it as new', () => {
    // Day 2: 10,000 new eligible plus 30,000 carried; cap 50,000 releases all of it.
    expect(settleDay({ eligibleMinor: 10_000n, carriedInMinor: 30_000n, capMinor: 50_000n })).toEqual({ payableMinor: 40_000n, carriedOutMinor: 0n });
  });
  it('keeps carrying when the cap is already used', () => {
    expect(settleDay({ eligibleMinor: 0n, carriedInMinor: 30_000n, capMinor: 10_000n })).toEqual({ payableMinor: 10_000n, carriedOutMinor: 20_000n });
  });
  it('refuses to settle without a configured cap', () => {
    expect(() => settleDay({ eligibleMinor: 1n, carriedInMinor: 0n, capMinor: 0n })).toThrow(/cap/);
  });
  it('keeps the books balanced for any inputs', () => {
    for (const [e, c, cap] of [[1n, 0n, 1n], [999n, 5n, 300n], [0n, 0n, 7n], [123456n, 98765n, 100000n]] as const) {
      const r = settleDay({ eligibleMinor: e, carriedInMinor: c, capMinor: cap });
      expect(r.payableMinor + r.carriedOutMinor).toBe(e + c);
      expect(r.payableMinor).toBeLessThanOrEqual(cap);
    }
  });
});

describe('product commission', () => {
  it('pays nothing while the policy is inactive', () => {
    expect(productCommission({ saleMinor: 100_000n, rateBps: 500, active: false, budgetMinor: 10_000_000n, requestedMinor: 100_000n })).toBe(0n);
  });
  it('applies the rate, the requested cap and the funded budget', () => {
    expect(productCommission({ saleMinor: 100_000n, rateBps: 500, active: true, budgetMinor: 10_000_000n, requestedMinor: 100_000n })).toBe(5_000n);
    expect(productCommission({ saleMinor: 100_000n, rateBps: 500, active: true, budgetMinor: 1_000n, requestedMinor: 100_000n })).toBe(1_000n);
    expect(productCommission({ saleMinor: 100_000n, rateBps: 500, active: true, budgetMinor: 10_000_000n, requestedMinor: 2_000n })).toBe(2_000n);
  });
});

describe('policy activation rules', () => {
  it('refuses sponsor and binary activation outright', () => {
    expect(policyActivationBlockers({ kind: 'BINARY', rateBps: 500, legalApprovalRef: 'LEGAL-APPROVED-1' }).join(' ')).toMatch(/Binary commission is disabled/);
    expect(policyActivationBlockers({ kind: 'DIRECT_SPONSOR', rateBps: 500, legalApprovalRef: 'LEGAL-APPROVED-1' }).join(' ')).toMatch(/Sponsor-linked/);
  });
  it('requires a rate and a legal approval reference for product policies', () => {
    expect(policyActivationBlockers({ kind: 'PRODUCT', rateBps: 0, legalApprovalRef: null }).length).toBe(2);
    expect(policyActivationBlockers({ kind: 'PRODUCT', rateBps: 300, legalApprovalRef: 'LEGAL-APPROVED-1' })).toEqual([]);
  });
  it('validates the daily cap', () => {
    expect(validateDailyCap(0n)).toMatch(/greater than zero/);
    expect(validateDailyCap(50_000n)).toBeNull();
  });
});
