// Membership tiers and their commission parameters.
// NOTE: these values are launch defaults. They must be confirmed by the business owner and legal counsel
// before going live. They are the single place where plan economics are defined.

import type { Currency } from './money';

export const TIERS = ['BASIC', 'SILVER', 'GOLD', 'PLATINUM'] as const;
export type Tier = (typeof TIERS)[number];

export interface PlanConfig {
  /** Membership fee in INR minor units (paise). Other currencies are converted at checkout. */
  priceInrMinor: bigint;
  durationDays: number;
  /** Direct commission on verified retail sales of members you sponsor (bps of PV). */
  directBps: number;
  /** Binary payout rate on matched PV (bps). 0 disables binary commission for the tier. */
  binaryBps: number;
  /** Maximum binary payout per member per day, INR minor units. */
  binaryDailyCapInrMinor: bigint;
  /** Advertising rewards: maximum completed ad views per day. */
  adViewsPerDay: number;
  /** Highest cashback coupon percent this tier may redeem (10, 20, 30 or 50). */
  couponMaxPercent: number;
}

export const PLANS: Record<Tier, PlanConfig> = {
  BASIC: {
    priceInrMinor: 0n,
    durationDays: 365,
    directBps: 300,
    binaryBps: 0,
    binaryDailyCapInrMinor: 0n,
    adViewsPerDay: 5,
    couponMaxPercent: 10,
  },
  SILVER: {
    priceInrMinor: 99_900n,
    durationDays: 365,
    directBps: 500,
    binaryBps: 1000,
    binaryDailyCapInrMinor: 500_000n,
    adViewsPerDay: 10,
    couponMaxPercent: 20,
  },
  GOLD: {
    priceInrMinor: 299_900n,
    durationDays: 365,
    directBps: 700,
    binaryBps: 1000,
    binaryDailyCapInrMinor: 1_500_000n,
    adViewsPerDay: 15,
    couponMaxPercent: 30,
  },
  PLATINUM: {
    priceInrMinor: 999_900n,
    durationDays: 365,
    directBps: 1000,
    binaryBps: 1000,
    binaryDailyCapInrMinor: 5_000_000n,
    adViewsPerDay: 20,
    couponMaxPercent: 50,
  },
};

/** Share of each verified retail sale (bps of PV) moved into the INR commission reserve. */
export const COMMISSION_FUNDING_BPS = 2500;

/** Platform spread applied when converting between wallet currencies (bps). */
export const FX_SPREAD_BPS = 150;

/** Minimum withdrawal per currency, in minor units. */
export const MIN_WITHDRAWAL: Record<Currency, bigint> = {
  INR: 50_000n,
  USD: 1_000n,
  EUR: 1_000n,
  GBP: 1_000n,
  AED: 3_000n,
  SGD: 1_500n,
  MYR: 4_000n,
  SAR: 3_000n,
};

export function isPaidTier(tier: Tier): boolean {
  return PLANS[tier].priceInrMinor > 0n;
}

export function tierRank(tier: Tier): number {
  return TIERS.indexOf(tier);
}

export type { Currency };
