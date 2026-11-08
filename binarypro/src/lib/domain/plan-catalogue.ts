// Membership catalogue rules. The admin can change price, duration, benefit text, coupon cap, daily ad limit
// and active status. Commission rates and binary daily caps are NOT editable here; they come from plans.ts.
import { PLANS, TIERS, type Tier } from './plans';

export const COUPON_CAPS = [10, 20, 30, 50] as const;
export const MAX_PLAN_PRICE_MINOR = 10_000_000n; // ₹1,00,000.00

export interface PlanRow {
  tier: Tier;
  name: string;
  priceInrMinor: bigint;
  durationDays: number;
  couponMaxPercent: number;
  adViewsPerDay: number;
  benefits: string[];
  active: boolean;
}

export interface EffectivePlan extends PlanRow {
  /** Fixed by the commission plan. Not editable from the admin catalogue. */
  directBps: number;
  binaryBps: number;
  binaryDailyCapInrMinor: bigint;
}

export interface PlanUpdate {
  name: string;
  priceInrMinor: bigint;
  durationDays: number;
  couponMaxPercent: number;
  adViewsPerDay: number;
  benefits: string[];
  active: boolean;
}

/** Built-in values, used when a tier has no stored row. */
export function defaultRow(tier: Tier): PlanRow {
  const p = PLANS[tier];
  return {
    tier,
    name: tier.charAt(0) + tier.slice(1).toLowerCase(),
    priceInrMinor: p.priceInrMinor,
    durationDays: p.durationDays,
    couponMaxPercent: p.couponMaxPercent,
    adViewsPerDay: p.adViewsPerDay,
    benefits: [],
    active: true,
  };
}

/** Combines a stored row (or the defaults) with the fixed commission settings. */
export function mergePlan(tier: Tier, row?: PlanRow | null): EffectivePlan {
  const base = row ?? defaultRow(tier);
  const fixed = PLANS[tier];
  return {
    ...base,
    directBps: fixed.directBps,
    binaryBps: fixed.binaryBps,
    binaryDailyCapInrMinor: fixed.binaryDailyCapInrMinor,
  };
}

export function validatePlanUpdate(u: PlanUpdate): string[] {
  const errors: string[] = [];
  if (u.name.trim().length < 2 || u.name.trim().length > 40) errors.push('Name must be 2 to 40 characters');
  if (u.priceInrMinor < 0n || u.priceInrMinor > MAX_PLAN_PRICE_MINOR) errors.push('Price must be between ₹0 and ₹1,00,000');
  if (!Number.isInteger(u.durationDays) || u.durationDays < 30 || u.durationDays > 1095) errors.push('Duration must be 30 to 1,095 days');
  if (!(COUPON_CAPS as readonly number[]).includes(u.couponMaxPercent)) errors.push('Coupon cap must be 10, 20, 30 or 50 percent');
  if (!Number.isInteger(u.adViewsPerDay) || u.adViewsPerDay < 0 || u.adViewsPerDay > 50) errors.push('Ad videos per day must be 0 to 50');
  if (u.benefits.length > 10) errors.push('Use at most 10 benefit lines');
  for (const b of u.benefits) if (b.length < 3 || b.length > 120) errors.push(`Benefit "${b.slice(0, 20)}…" must be 3 to 120 characters`);
  return errors;
}

export function tierList(): Tier[] {
  return [...TIERS];
}
