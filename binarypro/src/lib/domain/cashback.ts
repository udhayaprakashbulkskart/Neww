// Cashback coupons. Cashback is only ever funded by a merchant pool or a promotional pool with real balance.

import { applyBps } from './money';

export const ALLOWED_COUPON_PERCENTS = [10, 20, 30, 50] as const;
export type CouponPercent = (typeof ALLOWED_COUPON_PERCENTS)[number];

export function isAllowedCouponPercent(value: number): value is CouponPercent {
  return (ALLOWED_COUPON_PERCENTS as readonly number[]).includes(value);
}

export interface CashbackInput {
  subtotalMinor: bigint;
  orderCurrency: string;
  couponCurrency: string;
  percent: number;
  maxCashbackMinor: bigint;
  minOrderMinor: bigint;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
  now: Date;
  /** How many times this user has already redeemed this coupon (not reversed). */
  userRedemptions: number;
  perUserLimit: number;
  /** Real money available in the funding pool, in coupon currency. */
  poolBalanceMinor: bigint;
  /** The buyer's membership tier cap for coupon percent. */
  tierMaxPercent: number;
}

export type CashbackResult = { ok: true; cashbackMinor: bigint } | { ok: false; reason: string };

export function computeCashback(input: CashbackInput): CashbackResult {
  if (!isAllowedCouponPercent(input.percent)) return { ok: false, reason: 'Coupon percent is not an allowed tier' };
  if (input.percent > input.tierMaxPercent) return { ok: false, reason: `Your membership allows up to ${input.tierMaxPercent}% coupons` };
  if (!input.active) return { ok: false, reason: 'Coupon is not active' };
  if (input.now < input.startsAt || input.now > input.endsAt) return { ok: false, reason: 'Coupon is outside its validity window' };
  if (input.orderCurrency !== input.couponCurrency) return { ok: false, reason: 'Coupon currency does not match the order' };
  if (input.subtotalMinor < input.minOrderMinor) return { ok: false, reason: 'Order is below the coupon minimum' };
  if (input.userRedemptions >= input.perUserLimit) return { ok: false, reason: 'Coupon usage limit reached for this member' };
  if (input.poolBalanceMinor <= 0n) return { ok: false, reason: 'Coupon funding is exhausted' };

  let cashback = applyBps(input.subtotalMinor, input.percent * 100);
  if (cashback > input.maxCashbackMinor) cashback = input.maxCashbackMinor;
  if (cashback > input.poolBalanceMinor) cashback = input.poolBalanceMinor;
  if (cashback <= 0n) return { ok: false, reason: 'Cashback amount is zero' };
  return { ok: true, cashbackMinor: cashback };
}
