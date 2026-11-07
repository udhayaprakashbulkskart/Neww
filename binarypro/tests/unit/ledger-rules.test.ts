import { describe, expect, it } from 'vitest';
import { accountBalance, validateLegs } from '@/lib/domain/ledger-rules';

describe('double-entry validation', () => {
  it('accepts a balanced transaction per currency', () => {
    expect(() => validateLegs([
      { accountKey: 'a', direction: 'DEBIT', amountMinor: 100n, currency: 'INR' },
      { accountKey: 'b', direction: 'CREDIT', amountMinor: 100n, currency: 'INR' },
    ])).not.toThrow();
  });

  it('rejects an unbalanced transaction', () => {
    expect(() => validateLegs([
      { accountKey: 'a', direction: 'DEBIT', amountMinor: 100n, currency: 'INR' },
      { accountKey: 'b', direction: 'CREDIT', amountMinor: 99n, currency: 'INR' },
    ])).toThrow(/unbalanced/);
  });

  it('balances each currency independently (FX legs)', () => {
    expect(() => validateLegs([
      { accountKey: 'w1', direction: 'DEBIT', amountMinor: 100n, currency: 'USD' },
      { accountKey: 'fx1', direction: 'CREDIT', amountMinor: 100n, currency: 'USD' },
      { accountKey: 'fx2', direction: 'DEBIT', amountMinor: 8350n, currency: 'INR' },
      { accountKey: 'w2', direction: 'CREDIT', amountMinor: 8350n, currency: 'INR' },
    ])).not.toThrow();
  });

  it('rejects zero or negative legs', () => {
    expect(() => validateLegs([
      { accountKey: 'a', direction: 'DEBIT', amountMinor: 0n, currency: 'INR' },
      { accountKey: 'b', direction: 'CREDIT', amountMinor: 0n, currency: 'INR' },
    ])).toThrow(/positive/);
  });

  it('computes balances from the normal side', () => {
    expect(accountBalance('CREDIT', 30n, 100n)).toBe(70n);
    expect(accountBalance('DEBIT', 100n, 30n)).toBe(70n);
  });
});
