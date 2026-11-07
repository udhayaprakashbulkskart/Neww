// Pure double-entry validation. Every ledger transaction must balance per currency.

import type { Currency } from './money';

export interface LedgerLeg {
  accountKey: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: bigint;
  currency: Currency;
}

export function validateLegs(legs: LedgerLeg[]): void {
  if (legs.length < 2) throw new Error('A ledger transaction needs at least two legs');
  const net = new Map<Currency, bigint>();
  for (const leg of legs) {
    if (leg.amountMinor <= 0n) throw new Error(`Leg ${leg.accountKey} must have a positive amount`);
    const signed = leg.direction === 'DEBIT' ? leg.amountMinor : -leg.amountMinor;
    net.set(leg.currency, (net.get(leg.currency) ?? 0n) + signed);
  }
  for (const [currency, total] of net) {
    if (total !== 0n) throw new Error(`Ledger transaction is unbalanced in ${currency}`);
  }
}

/** Balance of an account given its normal side and the sums of debits and credits. */
export function accountBalance(normal: 'DEBIT' | 'CREDIT', debits: bigint, credits: bigint): bigint {
  return normal === 'CREDIT' ? credits - debits : debits - credits;
}

export function walletKey(userId: string, currency: Currency): string {
  return `WALLET:${userId}:${currency}`;
}
