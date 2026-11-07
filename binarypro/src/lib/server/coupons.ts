// Cashback coupons: created by merchants or promotions. Each coupon's cashback is backed by its pool.
import { isAllowedCouponPercent } from '@/lib/domain/cashback';
import { accounts } from './accounts';
import { audit } from './audit';
import { db } from './db';
import { DomainError } from './errors';
import { postTransaction } from './ledger';
import type { Currency } from '@/lib/domain/money';
import { randomUUID } from 'node:crypto';

export interface CouponInput {
  code: string;
  funding: 'MERCHANT' | 'PROMO';
  merchantId?: string | null;
  percent: number;
  maxCashbackMinor: bigint;
  minOrderMinor: bigint;
  currency: Currency;
  budgetMinor: bigint;
  perUserLimit: number;
  startsAt: Date;
  endsAt: Date;
}

export async function createCoupon(input: CouponInput, actorId: string) {
  if (!isAllowedCouponPercent(input.percent)) throw new DomainError('COUPON_PERCENT', 'Cashback must be 10, 20, 30 or 50 percent');
  if (input.funding === 'MERCHANT' && !input.merchantId) throw new DomainError('COUPON_FUNDING', 'Merchant coupons need a merchant');
  if (input.endsAt <= input.startsAt) throw new DomainError('COUPON_DATES', 'End date must be after start date');
  if (input.maxCashbackMinor <= 0n) throw new DomainError('COUPON_CAP', 'Maximum cashback must be positive');
  return db.$transaction(async (tx) => {
    const coupon = await tx.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(),
        funding: input.funding,
        merchantId: input.funding === 'MERCHANT' ? input.merchantId : null,
        percent: input.percent,
        maxCashbackMinor: input.maxCashbackMinor,
        minOrderMinor: input.minOrderMinor,
        currency: input.currency,
        budgetMinor: input.budgetMinor,
        perUserLimit: input.perUserLimit,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    });
    await audit(tx, { action: 'coupon.created', actorId, targetId: coupon.id, meta: { code: coupon.code, percent: input.percent } });
    return coupon;
  });
}

/** Funds a cashback pool. Money must come from the merchant or the promotions budget (cash in). */
export async function fundCouponPool(couponId: string, amountMinor: bigint, actorId: string) {
  if (amountMinor <= 0n) throw new DomainError('INVALID_AMOUNT', 'Amount must be positive');
  return db.$transaction(async (tx) => {
    const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new DomainError('NOT_FOUND', 'Coupon not found', 404);
    const currency = coupon.currency as Currency;
    const pool = coupon.funding === 'MERCHANT'
      ? accounts.merchantPool(coupon.merchantId!, currency)
      : accounts.promoPool(coupon.id, currency);
    await postTransaction(tx, {
      reference: `COUPONFUND:${couponId}:${randomUUID()}`,
      type: 'COUPON_FUNDING',
      description: `Cashback pool funding ${coupon.code}`,
      legs: [
        { ...accounts.cash(currency), direction: 'DEBIT', amountMinor },
        { ...pool, direction: 'CREDIT', amountMinor },
      ],
    });
    await audit(tx, { action: 'coupon.funded', actorId, targetId: couponId, meta: { amount: amountMinor.toString() } });
    return { couponId, funded: amountMinor };
  });
}
