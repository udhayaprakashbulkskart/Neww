// Multi-currency wallets: balances, currency conversion, and withdrawals.
import { randomUUID } from 'node:crypto';
import { applyBps, convertMinor, CURRENCIES, type Currency } from '@/lib/domain/money';
import { FX_SPREAD_BPS } from '@/lib/domain/plans';
import { validateWithdrawal } from '@/lib/domain/withdrawals';
import { accounts } from './accounts';
import { audit } from './audit';
import { db, type Tx } from './db';
import { DomainError } from './errors';
import { balanceOf, postTransaction } from './ledger';
import { loadRates } from './rates';

export async function walletBalances(userId: string): Promise<Record<Currency, bigint>> {
  const out = {} as Record<Currency, bigint>;
  for (const c of CURRENCIES) out[c] = await balanceOf(db, accounts.wallet(userId, c).key);
  return out;
}

/** Converts between wallet currencies at the platform rate minus the published spread. */
export async function convertWallet(userId: string, from: Currency, to: Currency, amount: bigint) {
  if (from === to) throw new DomainError('SAME_CURRENCY', 'Choose two different currencies');
  if (amount <= 0n) throw new DomainError('INVALID_AMOUNT', 'Amount must be positive');
  const rates = await loadRates();
  const gross = convertMinor(amount, from, to, rates);
  const received = applyBps(gross, 10_000 - FX_SPREAD_BPS);
  if (received <= 0n) throw new DomainError('AMOUNT_TOO_SMALL', 'Amount is too small to convert');
  const reference = `FX:${randomUUID()}`;
  return db.$transaction(async (tx) => {
    await postTransaction(tx, {
      reference,
      type: 'FX_CONVERSION',
      description: `Wallet conversion ${from} to ${to}`,
      legs: [
        { ...accounts.wallet(userId, from), direction: 'DEBIT', amountMinor: amount },
        { ...accounts.fxClearing(from), direction: 'CREDIT', amountMinor: amount },
        { ...accounts.fxClearing(to), direction: 'DEBIT', amountMinor: received },
        { ...accounts.wallet(userId, to), direction: 'CREDIT', amountMinor: received },
      ],
    });
    return { from, to, debited: amount, credited: received };
  });
}

export async function requestWithdrawal(userId: string, currency: Currency, amount: bigint) {
  return db.$transaction(async (tx: Tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { kyc: true } });
    const open = await tx.withdrawal.count({ where: { userId, status: 'REQUESTED' } });
    const balance = await balanceOf(tx, accounts.wallet(userId, currency).key);
    const check = validateWithdrawal({
      amountMinor: amount,
      currency,
      walletBalanceMinor: balance,
      kycVerified: user.kyc === 'VERIFIED',
      hasOpenWithdrawal: open > 0,
    });
    if (!check.ok) throw new DomainError('WITHDRAWAL_REJECTED', check.reason, 409);

    const w = await tx.withdrawal.create({ data: { userId, currency, amountMinor: amount, reference: `WD:${randomUUID()}` } });
    await postTransaction(tx, {
      reference: w.reference,
      type: 'WITHDRAWAL_REQUEST',
      description: 'Withdrawal requested',
      legs: [
        { ...accounts.wallet(userId, currency), direction: 'DEBIT', amountMinor: amount },
        { ...accounts.withdrawalPending(currency), direction: 'CREDIT', amountMinor: amount },
      ],
    });
    await audit(tx, { action: 'withdrawal.requested', actorId: userId, targetId: w.id, meta: { currency, amount: amount.toString() } });
    return w;
  });
}

/** Finance decision on a withdrawal. Approve = paid out to the bank (done offline); reject = refund to wallet. */
export async function decideWithdrawal(withdrawalId: string, decision: 'APPROVE' | 'REJECT', actorId: string) {
  return db.$transaction(async (tx) => {
    const w = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!w) throw new DomainError('NOT_FOUND', 'Withdrawal not found', 404);
    if (w.status !== 'REQUESTED') throw new DomainError('INVALID_STATE', 'Withdrawal already decided', 409);
    const currency = w.currency as Currency;
    const pendingLeg = { ...accounts.withdrawalPending(currency), direction: 'DEBIT' as const, amountMinor: w.amountMinor };
    if (decision === 'APPROVE') {
      await postTransaction(tx, {
        reference: `${w.reference}:APPROVE`,
        type: 'WITHDRAWAL_PAID',
        description: 'Withdrawal paid out',
        legs: [pendingLeg, { ...accounts.cash(currency), direction: 'CREDIT', amountMinor: w.amountMinor }],
      });
    } else {
      await postTransaction(tx, {
        reference: `${w.reference}:REJECT`,
        type: 'WITHDRAWAL_REJECTED',
        description: 'Withdrawal rejected and returned to wallet',
        legs: [pendingLeg, { ...accounts.wallet(w.userId, currency), direction: 'CREDIT', amountMinor: w.amountMinor }],
      });
    }
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewedAt: new Date(), reviewedBy: actorId },
    });
    await audit(tx, { action: `withdrawal.${decision.toLowerCase()}`, actorId, targetId: withdrawalId });
    return { id: withdrawalId, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
  });
}

