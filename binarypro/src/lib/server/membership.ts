// Membership subscriptions. Membership fees are NEVER a commission source (no joining-fee commissions).
import { PLANS, TIERS, type Tier } from '@/lib/domain/plans';
import { convertMinor, isCurrency, type Currency, BASE_CURRENCY } from '@/lib/domain/money';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { accounts } from './accounts';
import { postTransaction } from './ledger';
import { loadRates } from './rates';
import { effectivePlan } from './plans';
import { addDays } from './time';
import { audit } from './audit';

export function isMembershipActive(m: { active: boolean; expiresAt: Date } | null | undefined, now = new Date()): boolean {
  return !!m && m.active && m.expiresAt.getTime() > now.getTime();
}

export function parseTier(value: unknown): Tier {
  if (typeof value === 'string' && (TIERS as readonly string[]).includes(value)) return value as Tier;
  throw new DomainError('INVALID_TIER', 'Unknown membership tier');
}

/** Price for a tier in the requested currency. Free tiers return 0 in every currency. */
export async function membershipPrice(tier: Tier, currency: Currency, tx: Tx | typeof db = db): Promise<bigint> {
  const inr = (await effectivePlan(tier, tx)).priceInrMinor;
  if (inr === 0n) return 0n;
  const rates = await loadRates(tx);
  return convertMinor(inr, BASE_CURRENCY, currency, rates);
}

/** Activates or upgrades membership and extends its term. Caller must have verified payment. */
export async function activateMembership(tx: Tx, userId: string, tier: Tier, now = new Date()): Promise<void> {
  const existing = await tx.membership.findUnique({ where: { userId } });
  const base = existing && existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = addDays(base, (await effectivePlan(tier, tx)).durationDays);
  if (existing) {
    await tx.membership.update({ where: { userId }, data: { tier, active: true, expiresAt, startedAt: now } });
  } else {
    await tx.membership.create({ data: { userId, tier, active: true, startedAt: now, expiresAt } });
  }
  await audit(tx, { action: 'membership.activated', targetId: userId, meta: { tier } });
}

/** Ledger entry for a captured membership payment: cash in, recognised as membership revenue. */
export async function recordMembershipRevenue(tx: Tx, paymentId: string, amountMinor: bigint, currency: Currency) {
  await postTransaction(tx, {
    reference: `MEMBERSHIP_PAID:${paymentId}`,
    type: 'MEMBERSHIP_REVENUE',
    description: 'Membership payment captured',
    legs: [
      { ...accounts.cash(currency), direction: 'DEBIT', amountMinor },
      { ...accounts.membershipRevenue(currency), direction: 'CREDIT', amountMinor },
    ],
  });
}

export function currencyOrDefault(value: unknown, fallback: Currency): Currency {
  return typeof value === 'string' && isCurrency(value) ? value : fallback;
}
