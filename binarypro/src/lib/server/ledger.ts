// Double-entry ledger posting. Every movement of money goes through `postTransaction`.
// - Legs must balance per currency (validated before touching the database).
// - Accounts are row-locked in a stable order, so concurrent postings cannot overdraw a balance.
// - `reference` is an idempotency key: posting the same reference twice is a no-op.
// - Balances are never stored; they are derived from entries.

import { Prisma } from '@prisma/client';
import { accountBalance, validateLegs, type LedgerLeg } from '@/lib/domain/ledger-rules';
import type { Currency } from '@/lib/domain/money';
import { DomainError } from './errors';
import type { Tx } from './db';

export interface AccountSpec {
  key: string;
  normal: 'DEBIT' | 'CREDIT';
  allowNegative: boolean;
  currency: Currency;
  userId?: string | null;
}

export interface PostingLeg extends AccountSpec {
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
}

export interface PostResult {
  transactionId: string;
  duplicate: boolean;
}

const sideEffect = (normal: 'DEBIT' | 'CREDIT', direction: 'DEBIT' | 'CREDIT', amount: bigint): bigint => {
  const increases = normal === direction;
  return increases ? amount : -amount;
};

export async function postTransaction(
  tx: Tx,
  input: { reference: string; type: string; description: string; legs: PostingLeg[] },
): Promise<PostResult> {
  const existing = await tx.ledgerTransaction.findUnique({ where: { reference: input.reference }, select: { id: true } });
  if (existing) return { transactionId: existing.id, duplicate: true };

  const legs: LedgerLeg[] = input.legs.map((l) => ({
    accountKey: l.key,
    direction: l.direction,
    amountMinor: l.amountMinor,
    currency: l.currency,
  }));
  validateLegs(legs);

  // Ensure every account exists, then lock them in a deterministic order.
  const uniqueSpecs = new Map<string, AccountSpec>();
  for (const l of input.legs) {
    const prior = uniqueSpecs.get(l.key);
    if (prior && (prior.normal !== l.normal || prior.currency !== l.currency)) {
      throw new DomainError('LEDGER_SPEC_MISMATCH', `Account ${l.key} used with conflicting specs`, 500);
    }
    uniqueSpecs.set(l.key, l);
  }
  // Idempotent creation: concurrent postings may race to create the same account; duplicates are skipped.
  await tx.ledgerAccount.createMany({
    data: [...uniqueSpecs.values()].map((spec) => ({
      key: spec.key,
      normal: spec.normal,
      allowNegative: spec.allowNegative,
      currency: spec.currency,
      userId: spec.userId ?? null,
    })),
    skipDuplicates: true,
  });
  const keys = [...uniqueSpecs.keys()].sort();
  const accounts = await tx.ledgerAccount.findMany({ where: { key: { in: keys } }, orderBy: { key: 'asc' } });
  // Row locks: serialise concurrent postings touching the same accounts.
  await tx.$queryRaw`SELECT id FROM "LedgerAccount" WHERE key IN (${Prisma.join(keys)}) ORDER BY key FOR UPDATE`;

  // Overdraft check for accounts that may not go negative.
  for (const account of accounts) {
    if (account.allowNegative) continue;
    const delta = input.legs
      .filter((l) => l.key === account.key)
      .reduce((acc, l) => acc + sideEffect(account.normal, l.direction, l.amountMinor), 0n);
    if (delta >= 0n) continue;
    const current = await balanceOfAccountId(tx, account.id, account.normal);
    if (current + delta < 0n) {
      throw new DomainError('INSUFFICIENT_FUNDS', `Insufficient funds in ${account.key}`, 409);
    }
  }

  const created = await tx.ledgerTransaction.create({
    data: { reference: input.reference, type: input.type, description: input.description },
    select: { id: true },
  });
  const idByKey = new Map(accounts.map((a) => [a.key, a.id]));
  await tx.ledgerEntry.createMany({
    data: input.legs.map((l) => ({
      txId: created.id,
      accountId: idByKey.get(l.key)!,
      direction: l.direction,
      amountMinor: l.amountMinor,
      currency: l.currency,
    })),
  });
  return { transactionId: created.id, duplicate: false };
}

async function balanceOfAccountId(tx: Tx, accountId: string, normal: 'DEBIT' | 'CREDIT'): Promise<bigint> {
  const [debits, credits] = await Promise.all([
    tx.ledgerEntry.aggregate({ where: { accountId, direction: 'DEBIT' }, _sum: { amountMinor: true } }),
    tx.ledgerEntry.aggregate({ where: { accountId, direction: 'CREDIT' }, _sum: { amountMinor: true } }),
  ]);
  return accountBalance(normal, debits._sum.amountMinor ?? 0n, credits._sum.amountMinor ?? 0n);
}

/** Current balance of an account by key (0 if the account does not exist yet). */
export async function balanceOf(tx: Tx | typeof import('./db').db, key: string): Promise<bigint> {
  const account = await tx.ledgerAccount.findUnique({ where: { key }, select: { id: true, normal: true } });
  if (!account) return 0n;
  return balanceOfAccountId(tx as Tx, account.id, account.normal);
}
