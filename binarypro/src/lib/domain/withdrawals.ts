import { MIN_WITHDRAWAL } from './plans';
import type { Currency } from './money';

export function validateWithdrawal(input: {
  amountMinor: bigint;
  currency: Currency;
  walletBalanceMinor: bigint;
  kycVerified: boolean;
  hasOpenWithdrawal: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.kycVerified) return { ok: false, reason: 'Complete identity verification before withdrawing' };
  if (input.hasOpenWithdrawal) return { ok: false, reason: 'You already have a withdrawal awaiting review' };
  if (input.amountMinor < MIN_WITHDRAWAL[input.currency]) return { ok: false, reason: 'Amount is below the minimum withdrawal' };
  if (input.amountMinor > input.walletBalanceMinor) return { ok: false, reason: 'Insufficient wallet balance' };
  return { ok: true };
}
