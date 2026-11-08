import { describe, expect, it } from 'vitest';
import { mergePlan, validatePlanUpdate, type PlanUpdate } from '@/lib/domain/plan-catalogue';
import { PLANS } from '@/lib/domain/plans';

const good: PlanUpdate = {
  name: 'Gold',
  priceInrMinor: 299_900n,
  durationDays: 365,
  couponMaxPercent: 30,
  adViewsPerDay: 15,
  benefits: ['Shop with 30% cashback coupons', 'Up to 15 ad rewards a day'],
  active: true,
};

describe('membership catalogue merge', () => {
  it('uses stored price and benefits but keeps commission rates fixed', () => {
    const p = mergePlan('GOLD', { tier: 'GOLD', name: 'Gold', priceInrMinor: 350_000n, durationDays: 365, couponMaxPercent: 30, adViewsPerDay: 15, benefits: ['x'], active: true });
    expect(p.priceInrMinor).toBe(350_000n);
    expect(p.directBps).toBe(PLANS.GOLD.directBps);
    expect(p.binaryBps).toBe(PLANS.GOLD.binaryBps);
    expect(p.binaryDailyCapInrMinor).toBe(PLANS.GOLD.binaryDailyCapInrMinor);
  });

  it('falls back to built-in values when no row is stored', () => {
    const p = mergePlan('SILVER', null);
    expect(p.priceInrMinor).toBe(PLANS.SILVER.priceInrMinor);
    expect(p.couponMaxPercent).toBe(20);
    expect(p.active).toBe(true);
  });
});

describe('membership catalogue validation', () => {
  it('accepts a valid update', () => {
    expect(validatePlanUpdate(good)).toEqual([]);
  });

  it('rejects coupon caps other than the approved tiers', () => {
    expect(validatePlanUpdate({ ...good, couponMaxPercent: 25 })).toEqual(['Coupon cap must be 10, 20, 30 or 50 percent']);
  });

  it('rejects negative or excessive prices', () => {
    expect(validatePlanUpdate({ ...good, priceInrMinor: -1n }).length).toBe(1);
    expect(validatePlanUpdate({ ...good, priceInrMinor: 20_000_000n }).length).toBe(1);
  });

  it('rejects out-of-range duration, ad limit and benefit text', () => {
    const errs = validatePlanUpdate({ ...good, durationDays: 7, adViewsPerDay: 99, benefits: ['ok'] });
    expect(errs.length).toBe(3);
  });
});
