// Staff confirmation of a membership payment received by bank transfer. It runs the same revenue and activation
// steps as a provider-captured payment, and each bank reference can confirm only one payment.
import { db } from './db';
import { audit } from './audit';
import { DomainError } from './errors';
import { activateMembership, recordMembershipRevenue, parseTier } from './membership';
import { parseMinor } from '@/lib/domain/money';
import type { Currency } from '@/lib/domain/money';

export type ConfirmMethod = 'BANK' | 'CASH';

/**
 * Confirms a membership payment received offline. A bank transfer is confirmed with its bank reference.
 * Cash is confirmed with a receipt reference that is stored with a CASH- prefix, so it cannot clash with a bank reference.
 */
export async function confirmOfflineMembershipPayment(
  paymentId: string,
  input: { method?: ConfirmMethod; bankRef: string; amountRupees: string; receivedFrom?: string },
  actorId: string,
  now = new Date(),
) {
  const method: ConfirmMethod = input.method ?? 'BANK';
  const reference = input.bankRef.trim();
  if (reference.length < 6 || reference.length > 120) {
    throw new DomainError('VALIDATION', method === 'CASH' ? 'Enter the cash receipt reference (at least 6 characters)' : 'Enter the bank reference (at least 6 characters)', 422);
  }
  const bankRef = method === 'CASH' ? `CASH-${reference}` : reference;
  let amount: bigint;
  try {
    amount = parseMinor(input.amountRupees);
  } catch {
    throw new DomainError('VALIDATION', 'Enter the amount received in rupees, for example 999 or 999.00', 422);
  }
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new DomainError('NOT_FOUND', 'Payment not found', 404);
    if (payment.kind !== 'MEMBERSHIP') throw new DomainError('INVALID_KIND', 'Only membership payments can be confirmed this way', 422);
    if (payment.status !== 'PENDING') throw new DomainError('INVALID_STATE', `This payment is ${payment.status.toLowerCase()}, not pending`, 409);
    if (amount !== payment.amountMinor) {
      throw new DomainError('AMOUNT_MISMATCH', `The payment is for ₹${(Number(payment.amountMinor) / 100).toFixed(2)}. The amount received must match exactly.`, 422);
    }
    const used = await tx.payment.findUnique({ where: { bankRef } });
    if (used) throw new DomainError('DUPLICATE_BANK_REF', 'This bank reference has already confirmed a payment', 409);

    await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED', capturedAt: now, bankRef, confirmedBy: actorId } });
    await recordMembershipRevenue(tx, payment.id, payment.amountMinor, payment.currency as Currency);
    await activateMembership(tx, payment.userId, parseTier(payment.referenceId), now);
    await audit(tx, { action: 'payment.offline_confirmed', actorId, targetId: payment.id, meta: { method, bankRef, amount: amount.toString(), userId: payment.userId, receivedFrom: input.receivedFrom?.trim() || null } });
    return { paymentId: payment.id, userId: payment.userId, tier: payment.referenceId, status: 'CAPTURED' };
  });
}

export async function pendingMembershipPayments() {
  const payments = await db.payment.findMany({
    where: { kind: 'MEMBERSHIP', status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, userId: true, referenceId: true, amountMinor: true, currency: true, createdAt: true },
  });
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(payments.map((p) => p.userId))] } },
    select: { id: true, name: true, email: true, phone: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return payments.map((p) => ({ ...p, user: byId.get(p.userId) ?? { name: 'Unknown member', email: null, phone: null } }));
}
