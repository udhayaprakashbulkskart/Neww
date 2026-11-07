// Payments: membership and order checkout, and the signed, idempotent capture webhook.
// Settlement happens ONLY in the webhook (never on the client redirect), using the raw-body signature.
import { randomUUID } from 'node:crypto';
import type { Currency } from '@/lib/domain/money';
import { PLANS, type Tier } from '@/lib/domain/plans';
import { verifySignature } from '@/lib/domain/payments';
import { activateMembership, isMembershipActive, membershipPrice, parseTier, recordMembershipRevenue } from './membership';
import { markOrderPaid } from './orders';
import { fundCampaignTx } from './ads';
import { getConfig } from './config';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { audit } from './audit';
import { signPayload } from '@/lib/domain/payments';

export interface CapturedEvent {
  id: string;
  type: 'payment.captured';
  providerRef: string;
  amountMinor: string;
  currency: string;
}

export async function startMembershipCheckout(userId: string, tierInput: unknown, currencyInput: unknown) {
  const tier = parseTier(tierInput);
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { membership: true } });
  const current = user.membership;
  const order = ['BASIC', 'SILVER', 'GOLD', 'PLATINUM'] as Tier[];
  if (current && isMembershipActive(current) && order.indexOf(tier) < order.indexOf(current.tier as Tier)) {
    throw new DomainError('DOWNGRADE', 'Downgrades are not available mid-term', 409);
  }
  const currency = (typeof currencyInput === 'string' ? currencyInput : user.preferredCurrency) as Currency;
  const price = await membershipPrice(tier, currency);
  if (price === 0n) {
    await db.$transaction((tx) => activateMembership(tx, userId, tier));
    return { activated: true as const, tier };
  }
  const payment = await db.payment.create({
    data: {
      kind: 'MEMBERSHIP',
      referenceId: tier,
      userId,
      amountMinor: price,
      currency,
      providerRef: `mem_${randomUUID()}`,
    },
  });
  return { activated: false as const, paymentId: payment.id, providerRef: payment.providerRef, amountMinor: price, currency, tier };
}

/** Handles a verified provider event. Idempotent by provider event id. */
export async function handleCapturedEvent(event: CapturedEvent, now = new Date()) {
  const seen = await db.webhookEvent.findUnique({ where: { providerEventId: event.id } });
  if (seen) return { duplicate: true as const, held: false as const };

  return db.$transaction(async (tx: Tx) => {
    try {
      await tx.webhookEvent.create({ data: { providerEventId: event.id, type: event.type } });
    } catch {
      return { duplicate: true as const, held: false as const };
    }
    const payment = await tx.payment.findUnique({ where: { providerRef: event.providerRef } });
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Unknown payment reference', 404);
    if (payment.status === 'CAPTURED') return { duplicate: true as const, held: false as const };

    const amount = BigInt(event.amountMinor);
    if (amount !== payment.amountMinor || event.currency !== payment.currency) {
      // Amount mismatch: hold for review; never fulfil.
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'MISMATCH' } });
      await tx.fraudFlag.create({
        data: { userId: payment.userId, kind: 'PAYMENT_MISMATCH', detail: `Payment ${payment.id}: expected ${payment.amountMinor} ${payment.currency}, got ${event.amountMinor} ${event.currency}` },
      });
      await audit(tx, { action: 'payment.mismatch', targetId: payment.id });
      return { duplicate: false as const, held: true as const };
    }

    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED', capturedAt: now } });
    if (payment.kind === 'MEMBERSHIP') {
      await recordMembershipRevenue(tx, payment.id, payment.amountMinor, payment.currency as Currency);
      await activateMembership(tx, payment.userId, parseTier(payment.referenceId), now);
    } else if (payment.kind === 'ADS_TOPUP') {
      await fundCampaignTx(tx, payment.referenceId, payment.amountMinor, payment.userId, `ADTOPUP:${payment.id}`);
    } else {
      await markOrderPaid(tx, payment.referenceId, payment.id);
    }
    return { duplicate: false as const, held: false as const };
  });
}

/** Mock provider (sandbox only): produces a correctly signed webhook body and runs it through the real verifier. */
export async function simulateMockCapture(providerRef: string, userId: string) {
  if (getConfig().paymentProvider !== 'mock' || getConfig().isProd) {
    throw new DomainError('NOT_AVAILABLE', 'Simulated payments are not available', 404);
  }
  const payment = await db.payment.findUnique({ where: { providerRef } });
  if (!payment || payment.userId !== userId) throw new DomainError('NOT_FOUND', 'Payment not found', 404);
  const body = JSON.stringify({
    id: `evt_${randomUUID()}`,
    type: 'payment.captured',
    providerRef,
    amountMinor: payment.amountMinor.toString(),
    currency: payment.currency,
  });
  const cfg = getConfig();
  const sig = signPayload(cfg.webhookSecret, body);
  if (!verifySignature(cfg.webhookSecret, body, sig)) throw new Error('signature self-check failed');
  return handleCapturedEvent(JSON.parse(body) as CapturedEvent);
}

export { PLANS };
