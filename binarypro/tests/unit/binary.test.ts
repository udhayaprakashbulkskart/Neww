import { describe, expect, it } from 'vitest';
import { computeBinaryPayout, validatePlacement } from '@/lib/domain/binary';

describe('binary placement', () => {
  const base = {
    newUserId: 'new',
    sponsorId: 'sponsor',
    sponsorDownline: new Set(['sponsor', 'a', 'b']),
    occupiedSlots: new Set<string>(),
  };

  it('accepts an empty slot inside the sponsor downline', () => {
    expect(validatePlacement({ ...base, parentId: 'a', side: 'LEFT' })).toEqual({ ok: true });
    expect(validatePlacement({ ...base, parentId: 'sponsor', side: 'RIGHT' })).toEqual({ ok: true });
  });

  it('rejects a parent outside the sponsor downline', () => {
    const r = validatePlacement({ ...base, parentId: 'stranger', side: 'LEFT' });
    expect(r.ok).toBe(false);
  });

  it('rejects an occupied slot', () => {
    const r = validatePlacement({ ...base, parentId: 'a', side: 'LEFT', occupiedSlots: new Set(['a:LEFT']) });
    expect(r).toEqual({ ok: false, reason: 'That binary position is already taken' });
  });

  it('rejects placing a member under themselves', () => {
    const r = validatePlacement({ ...base, newUserId: 'a', parentId: 'a', side: 'LEFT' });
    expect(r.ok).toBe(false);
  });
});

describe('binary payout', () => {
  const rate = 1000; // 10%
  it('pays 10% of matched volume, consuming the matched PV', () => {
    const r = computeBinaryPayout({
      leftPvInrMinor: 100_000n,
      rightPvInrMinor: 60_000n,
      rateBps: rate,
      dailyCapInrMinor: 10_000_000n,
      reserveAvailableInrMinor: 10_000_000n,
    });
    expect(r.matchedPvInrMinor).toBe(60_000n);
    expect(r.payoutInrMinor).toBe(6_000n);
    expect(r.consumedPvInrMinor).toBe(60_000n);
  });

  it('carries forward the unmatched surplus (consumes only matched PV)', () => {
    const r = computeBinaryPayout({
      leftPvInrMinor: 100_000n, rightPvInrMinor: 0n, rateBps: rate,
      dailyCapInrMinor: 10_000_000n, reserveAvailableInrMinor: 10_000_000n,
    });
    expect(r.payoutInrMinor).toBe(0n);
    expect(r.consumedPvInrMinor).toBe(0n);
  });

  it('respects the daily cap and consumes only what was paid', () => {
    const r = computeBinaryPayout({
      leftPvInrMinor: 1_000_000n, rightPvInrMinor: 1_000_000n, rateBps: rate,
      dailyCapInrMinor: 5_000n, reserveAvailableInrMinor: 10_000_000n,
    });
    expect(r.payoutInrMinor).toBe(5_000n);
    // 5,000 payout at 10% consumes 50,000 PV from each leg
    expect(r.consumedPvInrMinor).toBe(50_000n);
  });

  it('never pays more than the funded reserve', () => {
    const r = computeBinaryPayout({
      leftPvInrMinor: 1_000_000n, rightPvInrMinor: 1_000_000n, rateBps: rate,
      dailyCapInrMinor: 10_000_000n, reserveAvailableInrMinor: 1_234n,
    });
    expect(r.payoutInrMinor).toBeLessThanOrEqual(1_234n);
    expect(r.payoutInrMinor).toBeGreaterThan(0n);
  });

  it('pays nothing when the rate is zero (basic tier)', () => {
    const r = computeBinaryPayout({
      leftPvInrMinor: 500n, rightPvInrMinor: 500n, rateBps: 0,
      dailyCapInrMinor: 10_000n, reserveAvailableInrMinor: 10_000n,
    });
    expect(r.payoutInrMinor).toBe(0n);
    expect(r.consumedPvInrMinor).toBe(0n);
  });
});
